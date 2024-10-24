#! /usr/bin/python3.8
import logging
import sys
sys.path.insert(0, '/var/www/laborop/Appli/')
sys.path.insert(0, '/var/www/laborop/env/lib/python3.8/site-packages')
from laborop import app as application
application.secret_key = 'abdegilmopstuv'

logging.basicConfig(stream=sys.stderr)
#print(sys.prefix)

#activate_this = python_home + '/bin/activate_this.py'
#execfile(activate_this, dict(__file__=activate_this))
