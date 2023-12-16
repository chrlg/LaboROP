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
}else if(isset($_GET["login"])){
    phpCAS::forceAuthentication();
}

if(phpCAS::isAuthenticated()){
    $phpUser=phpCAS::getUser();
    $_SESSION["clgme"] = phpCAS::getUser();
}else{
    $phpUser="ø";
}

if(isset($_SESSION["clgme"])){
    $clgme=$_SESSION["clgme"];
}else{
    $clgme="ø";
}

?>
<html>
  <head>
    <title>phpCAS simple client</title>
  </head>
  <body>
    <h1>Successfull Authentication!</h1>
    <p>Session <b><?php echo $clgme; ?></b>
    <p>the user's login is <b><?php echo $phpUser;?></b>.</p>
    <p>phpCAS version is <b><?php echo phpCAS::getVersion(); ?></b>.</p>
    <p><a href="?logout=">Logout</a></p>
    <p><a href="?login=">Login</a></p>
    <p><a href="?nothing=">Void</a></p>
  </body>
</html>
