from flask import Flask, send_from_directory, redirect, request, session
import os
import requests
import xmltodict

# configure flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
staticdir = os.path.join(basedir, 'static')

@app.route("/")
def root():
    if 'user' in session:
        return redirect("static/main.html#fromroot")
    return redirect("https://cas.enib.fr/login?service=https://laborop.enib.fr/retourcas")

@app.route("/retourcas", methods=['GET'])
def retourcas():
    try:
        ticket=request.args.get('ticket')
        r=requests.get(f"https://cas.enib.fr/serviceValidate?ticket={ticket}&service=https://laborop.enib.fr/retourcas")
        xml=xmltodict.parse(r.content)['cas:serviceResponse']['cas:authenticationSuccess']
        session['user']=xml['cas:user']
        attrs=xml['cas:attributes']
        session['ip']=attrs['cas:clientIpAddress']
        session['prenom']=attrs['cas:givenName']
        session['nom']=attrs['cas:sn']
        session['cn']=attrs['cas:cn']
        session['uid']=attrs['cas:uid']
        session['role']=attrs['cas:eduPersonAffiliation']
        return redirect("static/main.html#fromlogin")
    except:
        return f"<html><body><h3 style='color:red'>Erreur d'authentification</h3></body></html>"
    return rep


if __name__ == '__main__':
    app.run(debug=True, host="127.0.0.1", port=5000)
