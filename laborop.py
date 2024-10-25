from flask import Flask, send_from_directory, redirect, request, session
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
logging.basicConfig(filename='/var/www/laborop/laborop.log', level=logging.DEBUG)
sqcon=sqlite3.connect(os.path.join(basedir, 'DB', 'base.sqlite3'))

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
        r=requests.get(f"https://cas.enib.fr/serviceValidate?ticket={ticket}&service=https://laborop.enib.fr/retourcas")
        logging.debug(f"CAS validation contains response: {'cas:serviceResponse' in r.content} and success {'cas:serviceResponse' in r.content and 'cas:authenticationSuccess' in r.content['cas:serviceResponse']}")
        xml=xmltodict.parse(r.content)['cas:serviceResponse']['cas:authenticationSuccess']
        # Keep user name in session, for every "cloud" action 
        session['user']=xml['cas:user']
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
        cur=sqcon.cursor()
        cur.execute('INSERT INTO Users (login, cn, ip, ts, sn, givenName, uid, role) values (?,?,?,?,?,?,?,?) ON CONFLICT(login) DO UPDATE SET ip=?,ts=?', (session['user'].lower(), cn, ip, tse, nom, prenom, uid, role, ip,tse))
        cur.commit()

        logging.log(f"==Login== {ts.strprintf('%Y-%m-%d %H:%M:%S')} from «{session['user']}»≡«{uid}» @{ip} role={role}")
        return redirect("static/main.html?fromlogin")
    except:
        # Unless there was an error with CAS, in which case display a dumb error page
        return f"<html><body><h3 style='color:red'>Erreur d'authentification</h3><a href="/">Réessayer</a></body></html>"
    return rep


if __name__ == '__main__':
    app.run(debug=True, host="127.0.0.1", port=5000)
