from flask import Flask, send_from_directory, redirect, request, session, g
import os
import requests
import xmltodict
import logging
import datetime
import sqlite3
import datetime

# configure flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
staticdir = os.path.join(basedir, 'static')
dbdir = os.path.join(basedir, 'DB')
userdir = os.path.join(dbdir, 'Root')
sqpath=os.path.join(dbdir, 'base.sqlite3')

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
        os.chmod(dbdir, 0o775)
    if not os.path.isdir(userdir):
        os.mkdir(userdir)
        os.chmod(userdir, 0o775)
    db=sqlite3.connect(sqpath)
    cur=db.cursor()
    # User table. Only last login information. Used to get user from position or from group. Hence indexes
    cur.execute('create table if not exists Users (login text primary key, cn text, ip text, ts int, sn text, givenName text, uid text, role text, groupe text);')
    cur.execute("CREATE INDEX idx_groupe ON Users(groupe);")
    cur.execute("CREATE INDEX idx_user_ip ON Users(ip);")
    # Static table, to be filled by admin once for all. Associate IP with fancy names (dns or other), room name, and a position x/y on the room map
    cur.execute('CREATE TABLE if not exists Dns (ip text primary key, name text, x int, y int, salle text);')
    cur.execute('CREATE INDEX idx_salle ON Dns(salle);')
    cur.close()
    db.commit()
    os.chmod(sqpath, 0o664)

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
        session['user']=xml['cas:user']
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
        cur.execute('INSERT INTO Users (login, cn, ip, ts, sn, givenName, uid, role) values (?,?,?,?,?,?,?,?) ON CONFLICT(login) DO UPDATE SET ip=?,ts=?', (session['user'].lower(), cn, ip, tse, nom, prenom, uid, role, ip,tse))
        logging.debug(f"{tse} after exec")
        cur.close()
        sqcon.commit()
        logging.debug(f"{tse} Added login to DB")

        logging.info(f"==Login== {tss} from <{session['user']}>=<{uid}> @{ip} role={role}")
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

if __name__ == '__main__':
    app.run(debug=True, host="127.0.0.1", port=5000)
