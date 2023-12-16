<?php 

header("Access-Control-Allow-Origin: *");
session_start();

ini_set("display_errors", 1);
ini_set("display_startup_errors", 1);
ini_set("error_log", "/tmp/caserror.log");
error_reporting(E_ALL);

require_once("phpCAS-1.3.6/CAS.php");
phpCAS::setDebug();
phpCAS::setVerbose(true);
phpCAS::client(CAS_VERSION_2_0, "cas.enib.fr", 443, '', true);
phpCAS::setNoCasServerValidation();
phpCAS::forceAuthentication();
?>
<html>
  <head>
    <title>phpCAS simple client</title>
  </head>
  <body>
    <h1>Successfull Authentication!</h1>
    <p>the user's login is <b><?php echo phpCAS::getUser(); ?></b>.</p>
    <p>phpCAS version is <b><?php echo phpCAS::getVersion(); ?></b>.</p>
    <p><a href="?logout=">Logout</a></p>
  </body>
</html>
