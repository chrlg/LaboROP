<?php 

   function ls(){
      global $me;
      $dir = "./DB/" . $me . "/";
      if(!is_dir($dir)) mkdir($dir);
      print_r(scandir($dir));
      exit(0);
   }

   function whoami(){
      global $me;
      echo "{me:'$me'}";
      exit(0);
   }

   ini_set("display_errors", 1);
   ini_set("display_startup_errors", 1);
   error_reporting(E_ALL);

   if(!isset($_POST["action"])){
      echo '{error:"no action"}';
      exit(0);
   }

   $action = $_POST["action"];

   if(isset($_SERVER["REMOTE_USER"])) $me=$_SERVER["REMOTE_USER"];
   else $me="**unidentified**";

   if($action=="ls") ls();
   else if($action=="whoami") whoami();
   else if($action=="load") load($_POST["filename"]);
   else if($action=="save") save($_POST["filename"], $_POST["content"]);
   else echo "{error:'action unknown', detail:'$action'}";
?>
