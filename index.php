<?php 

header("Access-Control-Allow-Origin: *");
session_start();

ini_set("display_errors", 1);
ini_set("display_startup_errors", 1);
ini_set("error_log", "DB/caserror.log");
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
    $a=phpCas::getAttributes();
    $cn = 'ø'; if(isset($a['cn'])) $cn=$a['cn'];
    $cn = $a['cn'];
    $ip = 'ø'; if(isset($a['clientIpAddress'])) $ip=$a['clientIpAddress'];
    error_log("ME IS " . $_SERVER['REMOTE_ADDR'] . "($ip)  ⇔ $me aka $cn");
    $sql = new SQLite3('DB/users.db');
    $sql->exec("create table if not exists Login (login text, cn text, ip text, ts int)");
    $prep = $sql->prepare("INSERT into Login values (:x, :y, :z, :a)");
    $prep->bindValue(':x', $me);
    $prep->bindValue(':y', $cn);
    $prep->bindValue(':z', $ip);
    $prep->bindValue(':a', time());
    $prep->execute();

    readfile("main.html");
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
