from flask import Flask, send_from_directory, redirect, request, session, g, jsonify, abort
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
app.secret_key="AbdeGilM@bstuv"
basedir = os.path.abspath(os.path.dirname(__file__))
staticdir = os.path.join(basedir, 'static')
dbdir = os.path.join(basedir, 'DB')
userdir = os.path.join(dbdir, 'Root')
sqpath=os.path.join(dbdir, 'base.sqlite3')
modulepath=[os.path.join(basedir, x) for x in ('Modules', 'Modules/Eval', 'Modules/Matrix')]
URL="https://laborop.enib.fr"

os.umask(2) # Let the members of www-data write anything we write (logs, db and user files)

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
    cur.execute('create table if not exists Users (login text primary key, cn text, ip text, ts int, sn text, givenName text, uid text, role text, groupe text);')
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
        return redirect("static/main.html")
    # Not connected. Redirect to CAS 
    logging.debug(f"Root route called by unknown user. Redirecting to CAS")
    return redirect(f"https://cas.enib.fr/login?service={URL}/retourcas")

@app.route("/Module/<path:text>", methods=['GET', 'POST'])
def getModule(text):
    logging.debug(f"get module {text=}")
    fn=f'mod_{text}.json'
    for p in modulepath:
        if os.path.isfile(os.path.join(p, fn)): return send_from_directory(p, fn)
    abort(404)

@app.route("/retourcas", methods=['GET'])
def retourcas():
    # Called from CAS server. Get user info, and store them in session cookie. Then redirect to main that can now
    # access to session['user'] and the kind
    try:
        ticket=request.args.get('ticket')
        logging.debug(f"retourcas received ticket {ticket} presumably from CAS")
        r=requests.get(f"https://cas.enib.fr/serviceValidate?ticket={ticket}&service={URL}/retourcas")
        xml=xmltodict.parse(r.content)['cas:serviceResponse']['cas:authenticationSuccess']
        # Keep user name in session, for every "cloud" action 
        user=xml['cas:user'].lower()
        logging.debug(f"Returned auth {xml['cas:user']} from CAS")
    except:
        # Unless there was an error with CAS, in which case display a dumb error page
        return f"<html><body><h3 style='color:red'>Erreur d'authentification</h3><a href='/'>Réessayer</a></body></html>"

    session['user']=user

    try:
        attrs=xml['cas:attributes']
        ip=attrs['cas:clientIpAddress']
        prenom=attrs['cas:givenName']
        nom=attrs['cas:sn']
        cn=attrs['cas:cn']
        uid=attrs['cas:uid']
        role=attrs['cas:eduPersonAffiliation']
    except:
        # Unless there was an error with CAS, in which case display a dumb error page
        return f"<html><body><h3 style='color:red'>Erreur CAS</h3><p>Réponse CAS mal formée<p><a href='/'>Réessayer</a></body></html>"

    try:
        # Plus, update database
        createDbIfNeeded()
        logging.debug("Db created if needed")
        ts=datetime.datetime.now()
        tse=int(ts.timestamp())
        tss=ts.strftime("%Y-%m-%d %H:%M:%S")
        sqcon=getdb()
        cur=sqcon.cursor()
        cur.execute('INSERT INTO Users (login, cn, ip, ts, sn, givenName, uid, role) values (?,?,?,?,?,?,?,?) ON CONFLICT(login) DO UPDATE SET ip=?,ts=?', (user, cn, ip, tse, nom, prenom, uid, role, ip,tse))
        cur.close()
        sqcon.commit()
        cur=sqcon.cursor()
        res=cur.execute("SELECT groupe from Users where login=?", (user,))
        gr=list(res)[0][0]
        if gr=='prof':
            prof=session['prof']=1
        else:
            prof=session['prof']=0
        cur.close()

        # Log login
        logging.info(f"==Login== {tss} from <{user}>=<{uid}> @{ip} role={role}")

        # Warn if one is not lowercase or if login different from uid
        if user!=xml['cas:user'] or uid!=uid.lower() or user!=uid:
            logging.warn(f"***WARNING*** user={xml['cas:user']} {uid=}")
        return redirect("static/main.html")
    except:
        # Unless there was an error with CAS, in which case display a dumb error page
        return f"<html><body><h3 style='color:red'>Erreur base de données</h3><a href='/'>Réessayer</a></body></html>"
    return rep

@app.route("/logout")
def logout():
    del session['user']
    del session['prof']
    #return redirect("/")
    return redirect(f"https://cas.enib.fr/logout?service={URL}/retourcas")

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
    # For teachers, return a list of users. For others, return nothing
    if 'user' not in session: return jsonify({'error':'login'})
    if session['prof']==0: return jsonify({'permission':'denied'})
    logging.debug(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} lsUsers user={session['user']} prof={session['prof']}")
    cur=getdb().cursor()
    res=cur.execute('select login, cn, groupe from Users ORDER by sn, givenName')
    return jsonify({'users': [(r[0], r[1], r[2]) for r in res]})

@app.route("/whoami", methods=['POST'])
def routeWhoami():
    if 'user' in session: return jsonify({'me':session['user']})
    return jsonify({})

@app.route("/mv", methods=['POST'])
def routeMv():
    if 'user' not in session: return jsonify({'error':'login'})
    src=request.json['src']
    dest=request.json['dest']
    who=request.json['who']
    user=session['user']
    now = datetime.datetime.now().strftime("%Y-%m-%d_%H:%M:%S")
    thisdir,histdir=wdir(who)
    logging.debug(f"Called mv {now=} {user=} {who=} {src=} {dest=}")
    if illegalFn(dest): 
        logging.debug(f"{now} Illegal file name in mv <{dest}> for {user=}")
        return returnError('mv', f"Illegal filename «{dest}»")
    shutil.move(os.path.join(thisdir, src), os.path.join(thisdir, dest))
    logging.info(f"==Move== {now} {user=} {who=} {src=} {dest=}")
    return jsonify({'ok':'ok'})

@app.route('/copy', methods=['POST'])
def routeCopy():
    if 'user' not in session: return jsonify({'error':'login'})
    fn=request.json['fn']
    who=request.json['who']
    user=session['user']
    now = datetime.datetime.now().strftime("%Y-%m-%d_%H:%M:%S")
    thisdir,histdir=wdir(who)
    logging.debug(f"Called copy {now=} {user=} {who=} {fn=}")
    if illegalFn(fn): 
        logging.debug(f"{now} Illegal file name in copy <{fn}> for {user=}")
        return returnError('copy', f"Illegal filename «{fn}»")
    shutil.copy(os.path.join(thisdir, fn), os.path.join(thisdir, f"Copie de {fn}"))
    logging.info(f"==Copy== {now} {user=} {who=} {fn=}")
    return jsonify({'ok':'ok'})

@app.route('/rm', methods=['POST'])
def routeRm():
    if 'user' not in session: return jsonify({'error':'login'})
    fn=request.json['fn']
    who=request.json['who']
    user=session['user']
    now = datetime.datetime.now().strftime("%Y-%m-%d_%H:%M:%S")
    thisdir,histdir=wdir(who)
    logging.debug(f"Called rm {now=} {user=} {who=} {fn=}")
    if illegalFn(fn): 
        logging.debug(f"{now} Illegal file name in rm <{fn}> for {user=}")
        return returnError('rm', f"Illegal filename «{fn}»")
    os.remove(os.path.join(thisdir, fn))
    logging.info(f"==Rm== {now} {user=} {who=} {fn=}")
    return jsonify({'ok':'ok'})

@app.route("/listRooms", methods=['POST', 'GET'])
def routeLsRooms():
    if 'prof' not in session: return jsonify([])
    if session['prof']!=1: return jsonify([])
    cur=getdb().cursor()
    res=cur.execute('SELECT DISTINCT salle FROM Dns ORDER by salle')
    return jsonify([r[0] for r in res if r[0] is not None and r[0].strip()!=''])

@app.route("/listGroups", methods=['POST', 'GET'])
def routeLsGroups():
    if 'prof' not in session: return jsonify([])
    if session['prof']!=1: return jsonify([])
    cur=getdb().cursor()
    res=cur.execute('SELECT DISTINCT groupe FROM Users ORDER by groupe')
    return jsonify([r[0] for r in res if r[0] is not None and r[0].strip()!=''])

@app.route("/activityGroup", methods=['POST'])
def routeActivityGroup():
    if 'prof' not in session: return jsonify([])
    if session['prof']!=1: return jsonify([])
    gr=request.json['group']
    now=datetime.datetime.now().timestamp()
    limit=int(now-request.json['limit'])
    cur=getdb().cursor()
    if gr is None:
        res=cur.execute('SELECT cn, ip, ts from Users where groupe is null AND ts>? ORDER by ts DESC', (limit,))
    else:
        res=cur.execute('SELECT cn, ip, ts from Users where groupe=? AND ts>? ORDER by ts DESC', (gr, limit))
    return jsonify([(r[0], r[1], now-r[2], None, None) for r in res])

@app.route("/activityRoom", methods=['POST'])
def routeActivityRoom():
    if 'prof' not in session: return jsonify([])
    if session['prof']!=1: return jsonify([])
    room=request.json['room']
    if room is None or room=='-' or room=='': return jsonify([])
    now=datetime.datetime.now().timestamp()
    limit=int(now-request.json['limit'])
    cur=getdb().cursor()
    res=cur.execute('SELECT Users.cn, Dns.name, Users.ts, Dns.x, Dns.y from Users LEFT JOIN Dns ON Users.ip=Dns.ip where Dns.salle=? AND ts>?', (room, limit))
    return jsonify([(r[0], r[1], now-r[2], r[3], r[4]) for r in res])


if __name__ == '__main__':
    logging.basicConfig(filename='dev.log', level=logging.DEBUG)
    URL="http://localhost:5000"
    app.run(debug=True, host="127.0.0.1", port=5000)
elif 'Dev' in app.root_path:
    print('Dev version')
    URL="http://localhost:5000"
else:
    logging.basicConfig(filename='/var/www/laborop/laborop.log', level=logging.INFO)
