from flask import Flask, send_from_directory, redirect, request, session, g, jsonify
import os
import requests
import xmltodict
import logging
import datetime
import sqlite3
import datetime
import shutil

# configure flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
staticdir = os.path.join(basedir, 'static')
dbdir = os.path.join(basedir, 'DB')
userdir = os.path.join(dbdir, 'Root')
sqpath=os.path.join(dbdir, 'base.sqlite3')

os.umask(0) # Let the members of www-data write anything we write (logs, db and user files)
logging.basicConfig(filename='/var/www/laborop/laborop.log', level=logging.DEBUG)

def getdb():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(sqpath)
    return db

def createDbIfNeeded():
    if os.path.isfile(sqpath): return
    if not os.path.isdir(dbdir):
        os.mkdir(dbdir)
    if not os.path.isdir(userdir):
        os.mkdir(userdir)
    db=sqlite3.connect(sqpath)
    cur=db.cursor()
    # User table. Only last login information. Used to get user from position or from group. Hence indexes
    # Note: role is from CAS. prof is manually inserted. If 'role' is reliable, could be used instead of 'prof'
    cur.execute('create table if not exists Users (login text primary key, cn text, ip text, ts int, sn text, givenName text, uid text, role text, groupe text, prof int default 0);')
    cur.execute("CREATE INDEX idx_groupe ON Users(groupe);")
    cur.execute("CREATE INDEX idx_user_ip ON Users(ip);")
    # Static table, to be filled by admin once for all. Associate IP with fancy names (dns or other), room name, and a position x/y on the room map
    cur.execute('CREATE TABLE if not exists Dns (ip text primary key, name text, x int, y int, salle text);')
    cur.execute('CREATE INDEX idx_salle ON Dns(salle);')
    cur.close()
    db.commit()
    os.chmod(sqpath, 0o775)

@app.route("/")
def root():
    if 'user' in session:
        logging.debug(f"Root route called by {session['user']}. Redirecting to main")
        # Already connected. Just load main html file
        return redirect("static/main.html?fromroot")
    # Not connected. Redirect to CAS 
    logging.debug(f"Root route called by unknown user. Redirecting to CAS")
    return redirect("https://cas.enib.fr/login?service=https://laborop.enib.fr/retourcas")

@app.route("/retourcas", methods=['GET'])
def retourcas():
    # Called from CAS server. Get user info, and store them in session cookie. Then redirect to main that can now
    # access to session['user'] and the kind
    try:
        ticket=request.args.get('ticket')
        logging.debug(f"retourcas received ticket {ticket} presumably from CAS")
        logging.debug(f"uid={os.getuid()} gid={os.getgid()} groups={os.getgroups()} {sqpath=}")
        createDbIfNeeded()
        logging.debug("Db created if needed")
        r=requests.get(f"https://cas.enib.fr/serviceValidate?ticket={ticket}&service=https://laborop.enib.fr/retourcas")
        xml=xmltodict.parse(r.content)['cas:serviceResponse']['cas:authenticationSuccess']
        # Keep user name in session, for every "cloud" action 
        session['user']=user=xml['cas:user'].lower()
        logging.debug(f"Returned auth {xml['cas:user']} from CAS")
        # Plus, update database
        attrs=xml['cas:attributes']
        ip=attrs['cas:clientIpAddress']
        prenom=attrs['cas:givenName']
        nom=attrs['cas:sn']
        cn=attrs['cas:cn']
        uid=attrs['cas:uid']
        role=attrs['cas:eduPersonAffiliation']
        ts=datetime.datetime.now()
        tse=int(ts.timestamp())
        tss=ts.strftime("%Y-%m-%d %H:%M:%S")
        sqcon=getdb()
        cur=sqcon.cursor()
        logging.debug("before exec")
        cur.execute('INSERT INTO Users (login, cn, ip, ts, sn, givenName, uid, role) values (?,?,?,?,?,?,?,?) ON CONFLICT(login) DO UPDATE SET ip=?,ts=?', (user, cn, ip, tse, nom, prenom, uid, role, ip,tse))
        cur.close()
        sqcon.commit()
        cur=sqcon.cursor()
        res=cur.execute("SELECT prof from Users where login=?", (user,))
        prof=session['prof']=list(res)[0][0]
        cur.close()

        # Log login
        logging.info(f"==Login== {tss} from <{user}>=<{uid}> @{ip} role={role}")

        # Warn if one is not lowercase or if login different from uid
        if user!=xml['cas:user'] or uid!=uid.lower() or user!=uid:
            logging.warn(f"***WARNING*** user={xml['cas:user']} {uid=}")
        return redirect("static/main.html?fromlogin")
    except:
        # Unless there was an error with CAS, in which case display a dumb error page
        return f"<html><body><h3 style='color:red'>Erreur d'authentification</h3><a href='/'>Réessayer</a></body></html>"
    return rep

@app.route("/logout")
def logout():
    del session['user']
    #return redirect("/")
    return redirect("https://cas.enib.fr/logout?service=https://laborop.enib.fr/retourcas")

# Function to check filenames 
def illegalFn(fn):
    if "." in fn: return True
    if "·" in fn: return True
    if "/" in fn: return True
    if "\\" in fn: return True
    if "\n" in fn: return True
    return False

# Return an error to an ajax call
def returnError(action, err):
    return jsonify({'action':action, 'error':err, 'user':session['user']})

# Get the real directory from which pyro files should be taken 
# (That is, DB/Root/user. Unless we are teacher and specified another user. Unless there is a ·Eval subdir in that dir)
def wdir(who):
    # Default dir is just DB/Root/user
    thisdir=os.path.join(userdir, session['user'])
    # Unless we are a teacher and have specified another user dir
    if session['prof']==1 and who:
        thisdir=os.path.join(userdir, who)
    # Unless that dir contains a "·Eval" subdir
    evaldir=os.path.join(thisdir, '·Eval')
    if os.path.isdir(evaldir):
        logging.debug(f"Found a eval dir in {thisdir}")
        thisdir=evaldir
    # Create thisdir if it doesn't exist
    histdir=os.path.join(thisdir, '·Hist')
    if not os.path.isdir(thisdir):
        logging.debug(f"creating user dir {thisdir}")
        os.mkdir(thisdir)
        os.mkdir(histdir)
    return thisdir, histdir

@app.route("/ls", methods=['POST'])
def routeLs():
    if 'user' not in session: return jsonify({'error':'login'})
    who=request.json['who']
    prof=session['prof']
    logging.debug(f"ls user={session['user']} {who=} {prof=}")
    thisdir,histdir=wdir(who)
    # List of files
    logging.debug(f"listdir={os.listdir(thisdir)} thistdir={thisdir}")
    l=[x for x in os.listdir(thisdir) if x[0]!='.' and x[0]!='·' and os.path.isfile(f"{thisdir}/{x}")]
    # For teachers, add a list of users
    if prof:
        pass
    logging.debug(f"result is {l=}")

    return jsonify(l)

@app.route("/save", methods=['POST'])
def routeSave():
    if 'user' not in session: return jsonify({'error':'login'})
    fn=request.json['fn']
    code=request.json['code']
    who=request.json['who']
    user=session['user']
    dt=datetime.datetime.now()
    now = dt.strftime("%Y-%m-%d_%H:%M:%S")
    ts=int(dt.timestamp())
    # Check filename for / and . and stuff
    if illegalFn(fn): 
        logging.debug(f"{now} Illegal file name in save <{fn}> for {user=}")
        return returnError('save', f"Illegal filename «{fn}»")
    # This is the full path of the file we are about to save
    thisdir,histdir=wdir(who)
    fullName = os.path.join(thisdir, fn)
    histName = os.path.join(histdir, f"{now}_{fn}")
    # If file exists already, save it
    if os.path.isfile(fullName):
        shutil.move(fullName, histName)
    with open(fullName, 'w') as f: f.write(code)
    logging.info(f"==Save== {now} {user=} {who=} file=<{fullName} size={len(code)}>")

    # Update user activity
    ip=request.remote_addr
    db=getdb()
    cur=db.cursor()
    cur.execute('UPDATE Users SET ts=?, ip=? WHERE login=?', (ts, ip, user))
    db.commit()
    
    # Return a ok
    return jsonify({'saved':'ok'})

@app.route("/load", methods=['POST'])
def routeLoad():
    if 'user' not in session: return jsonify({'error':'login'})
    src=request.json['src']
    who=request.json['who']
    user=session['user']
    now = datetime.datetime.now().strftime("%Y-%m-%d_%H:%M:%S")
    thisdir,histdir=wdir(who)
    if illegalFn(src):
        logging.debug(f"{now} Illegal file name in load <{src}> for {user=}")
        return returnError('load', f"Illegal filename «{src}»")
    try:
        with open(os.path.join(thisdir,src)) as f: code=f.read()
        logging.debug(f"{now} open file {src} by {user} {who=}")
        return jsonify({'src':src, 'code':code})
    except:
        logging.error(f"{now} failed open file {src} by {user} {who=} {thisdir=}")
        return returnError('load', 'cannot open file')


@app.route("/lsUsers", methods=['POST'])
def routeLsUsers():
    logging.debug('xxxxx')
    # For teachers, return a list of users. For others, return nothing
    if 'user' not in session: return jsonify({'error':'login'})
    if session['prof']==0: return jsonify({'permission':'denied'})
    logging.debug(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} lsUsers user={session['user']} prof={session['prof']}")
    cur=getdb().cursor()
    res=cur.execute('select login, cn, groupe from Users')
    return jsonify({'users': [(r[0], r[1], r[2]) for r in res]})

if __name__ == '__main__':
    app.run(debug=True, host="127.0.0.1", port=5000)
