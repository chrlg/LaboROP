#!/bin/bash

sqlite3 ./DB/base.sqlite3 <<HEREDOC
BEGIN TRANSACTION;
-- Only last login information
-- That table should, after a while, be quasi-static table of users, with only ip/ts being updated.
-- It will be used -> to get user from position (ip) ; to get full names of users ; to get list of users by group. 
-- Hence indexes
create table if not exists Users (login text, cn text, ip text, ts int, sn text, givenName text, uid text, role text, groupe text);
CREATE UNIQUE INDEX idx_login ON Users(login);
CREATE INDEX idx_groupe ON Users(groupe);
CREATE INDEX idx_user_ip ON Users(ip);
COMMIT;

-- Static table, created by admin once for all
-- Associate IP with fancy names (dns or other), room name, and a position x/y on the room map
BEGIN TRANSACTION;
CREATE TABLE if not exists Dns (ip text, name text, x int, y int, salle text);
CREATE INDEX idx_salle ON Dns(salle);
CREATE UNIQUE INDEX idx_machine_ip ON Dns(ip);
COMMIT;
HEREDOC

while [[ "$1" != "" ]]
do
    if [[ "$1" = "--dns" ]] && [[ -f "$2" ]]
    then
        sqlite3 ./DB/base.sqlite3 < "$2"
        shift 2
        continue
    fi
    shift
done
