<?php 

header("Access-Control-Allow-Origin: *");
session_start();

ini_set("display_errors", 1);
ini_set("display_startup_errors", 1);
ini_set("error_log", "/tmp/caserror.log");
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
    error_log("ME IS " . $_SERVER['REMOTE_ADDR'] . " ⇔ $me");
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
