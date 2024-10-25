from flask import Flask, send_from_directory, redirect, request, session
import os
import requests
import xmltodict
import logging
import datetime

# configure flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
staticdir = os.path.join(basedir, 'static')
logging.basicConfig(filename='/var/www/laborop/laborop.log', level=logging.DEBUG)

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
        session['user']=xml['cas:user']
        attrs=xml['cas:attributes']
        session['ip']=attrs['cas:clientIpAddress']
        session['prenom']=attrs['cas:givenName']
        session['nom']=attrs['cas:sn']
        session['cn']=attrs['cas:cn']
        session['uid']=attrs['cas:uid']
        session['role']=attrs['cas:eduPersonAffiliation']
        logging.log(f"==Login== from «{session['user']}»≡«{session['uid']}»
        return redirect("static/main.html?fromlogin")
    except:
        # Unless there was an error with CAS, in which case display a dumb error page
        return f"<html><body><h3 style='color:red'>Erreur d'authentification</h3><a href="/">Réessayer</a></body></html>"
    return rep


if __name__ == '__main__':
    app.run(debug=True, host="127.0.0.1", port=5000)
