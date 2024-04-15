<?php 

header("Access-Control-Allow-Origin: *");
session_start();

ini_set("display_errors", 1);
ini_set("display_startup_errors", 1);
ini_set("error_log", "DB/proferror.log");
error_reporting(E_ALL);

require_once("lib/phpCAS-1.3.6/CAS.php");
phpCAS::setDebug();
phpCAS::setVerbose(true);
phpCAS::client(CAS_VERSION_2_0, "cas.enib.fr", 443, '', true);
phpCAS::setNoCasServerValidation();

if(isset($_GET["logout"])){
    phpCAS::logout();
    exit(0);
};
if(isset($_GET["login"]) || !phpCAS::isAuthenticated()){
    phpCAS::forceAuthentication();
}
if(phpCAS::isAuthenticated()){
    $me = phpCAS::getUser();
    $_SESSION["clgme"] = $me;
    if($me!='legal' && $me!='gaubert') exit(0);
    $a=phpCas::getAttributes();
    chmod('DB/users.db', 0664);
    $sql = new SQLite3('DB/users.db');
    $sql->exec("create table if not exists Login (login text, cn text, ip text, ts int, sn text)");
    $sql->exec("create table if not exists activity (login text, ts int, what text)");
    $sql->exec("CREATE TABLE if not exists dns (ip text, name text)");
    $sql->exec("create table if not exists groups (login text, gid text)");

    readfile("prof.html");
    exit(0);
}
?>
<html>
  <head>
    <title>Échec de la connexion</title>
  </head>
  <body>
    <p>phpCAS version is <b><?php echo phpCAS::getVersion(); ?></b>.</p>
    <p><a href="?logout=">Logout</a></p>
    <p><a href="?login=">Retry</a></p>
  </body>
</html>
