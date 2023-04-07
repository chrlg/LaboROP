#!/usr/local/bin/python3

import os
import sys
import sqlite3
import json

def uniq(l):
    if len(l)==0:
        return []
    if len(l)==1:
        return l
    pre1=l[0].split("__")[0]
    pre2=l[1].split("__")[0]
    if pre1==pre2:
        return uniq(l[1:])
    else:
        return [l[0]] + uniq(l[1:])

def parseSourceDir(srcdir, out):
    l=sorted([x for x in os.listdir(srcdir) if x.endswith(".tgz")])
    l=uniq(l)
    for x in l: processTgz(srcdir, out, x)

def processTgz(root, out, tgz):
    name=tgz.split("__")[0]
    dirname="/tmp/Extr_"+name
    pwd=os.getcwd()
    os.mkdir(dirname)
    os.chdir(dirname)
    os.system("tar xzf "+root+"/"+tgz)
    findSqlite(out, dirname)
    os.chdir(pwd)
    os.system("rm -fr "+dirname)

def findSqlite(out, home):
    for root, d, f in os.walk(home):
        if not(root.endswith(".default")): continue
        if not "webappsstore.sqlite" in f: continue
        extrSqlite(out, root+"/webappsstore.sqlite")

def extrSqlite(out, sqf):
   co=sqlite3.connect(sqf)
   c=co.cursor()
   c.execute("select value from webappsstore2 where key='laborop_files';")
   l=c.fetchall()
   co.close()
   if len(l)!=1:
      print("Error with "+sqf)
   js=json.loads(l[0][0])
   st=sqf.split("/")[2].split("Extr_")[1]
   if not(os.path.exists(out+"/"+st)): os.mkdir(out+"/"+st)
   for f in js:
      fn=f["name"].replace(":", "_").replace("/", "_")
      o=open(out+"/"+st+"/"+fn, "w")
      o.write(f["code"])
      o.close()


def main():
    os.system("rm -fr /tmp/Extr_*")
    if len(sys.argv)!=3:
        print("Usage: extractExam.py sourceDir destDir")
        exit(1)
    parseSourceDir(sys.argv[1], sys.argv[2])

main()
