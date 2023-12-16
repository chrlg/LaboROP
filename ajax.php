<?php 

    header('Content-Type: application/json; charset=utf-8');
    session_start();

   function ls(){
      global $me;
      $dir = "./DB/Root/" . $me . "/";
      if(!is_dir($dir)) mkdir($dir);
      if(!is_dir($dir.'·Hist')) mkdir($dir.'·Hist');
      chmod($dir, 0775);
      $rep=array();
      foreach(scandir($dir) as $d){
        if($d=='.') continue;
        if($d=='..') continue;
        if($d=='·Hist') continue;
        array_push($rep, $d);
      }
      echo json_encode($rep);
      error_log("ME IS " . $_SERVER['REMOTE_ADDR'] . " ⇔ $me");
      exit(0);
   }

   function whoami(){
      global $me;
      echo '{"me":"'.$me.'"}';
      exit(0);
   }

   function illegal($fn){
        if(strpos($fn, ".")!==false) return true;
        if(strpos($fn, "/")!==false) return true;
        if(strpos($fn, "\\")!==false) return true;
        return false;
   }

   function mv($data){
      global $me;
      $pref = './DB/Root/' . $me . "/";
      $src=$pref.$data->src;
      $dest=$pref.$data->dest;
      if(illegal($data->src) || illegal($data->dest)){
          error_log("mv: Illegal name ".$src);
        echo '{"ok":"ko"}';
        exit(0);
      }
      rename($src, $dest);
      error_log("mv success «${src}» «${dest}»");
      echo '{"ok":"ok"}';
      exit(0);
   }

   function load($data){
      global $me;
      $pref = './DB/Root/' . $me . "/";
      $src = $pref.$data->src;
      if(illegal($data->src)){
        error_log("load: illegal name ".$src);
        echo '{"ok":"ko"}';
        exit(0);
      }
      $txt = file_get_contents($src);
      $rep = array('src' => $data->src, 'code' => $txt);
      echo json_encode($rep);
      exit(0);
   }

   function save($data){
      global $me;
      $pref = './DB/Root/' . $me . "/";
      $fn=$pref.$data->fn;
      if(illegal($data->fn)){
        error_log("save: illegal " . $fn);
        echo '{"saved":"no"}';
        exit(0);
      }
      if(is_file($fn)){
        copy($fn, $pref."·Hist/".date("Y-m-d h:i:sa")."_".$data->fn);
      }
      $nb=file_put_contents($fn, $data->code);
      if(!$nb) {
        echo '{"saved":"no"}';
      }else{
        echo '{"saved":"ok"}';
      }
      exit(0);
   }

   function rmm($data){
      global $me;
      $pref = './DB/Root/' . $me . "/";
      $fn=$pref.$data->fn;
      if(illegal($data->fn)){
        error_log("rm: illegal " . $fn);
        echo '{"ok":"ko"}';
        exit(0);
      }
      unlink($fn);
      echo '{"rm":"ok"}';
      exit(0);
   }

   function copym($data){
      global $me;
      $pref = './DB/Root/' . $me . "/";
      $fn=$pref.$data->fn;
      if(illegal($data->fn)){
        error_log("copy: illegal " . $fn);
        echo '{"ok":"ko"}';
        exit(0);
      }
      copy($fn, $fn."(copie)");
      echo '{"copy":"ok"}';
      exit(0);
   }

   ini_set("display_errors", 1);
   ini_set("display_startup_errors", 1);
   ini_set("error_log", "/tmp/ajaxerror.log");
   error_reporting(E_ALL);

   $json = file_get_contents('php://input');
   $data = json_decode($json);

   if(!isset($data->action)){
      echo '{"error":"no action"}';
      exit(0);
   }

   $action = $data->action;

   if(isset($_SERVER["REMOTE_USER"])) $me=$_SERVER["REMOTE_USER"];
   else if(isset($data->me)) {
        $me=$data->me;
        $_SESSION["me"] = $me;
   }
   else if(isset($_SESSION["me"])) $me=$_SESSION["me"];
   else $me="——unidentified——";



   if($action=="ls") ls();
   else if($action=="whoami") whoami();
   else if($action=="mv") mv($data);
   else if($action=="load") load($data);
   else if($action=="save") save($data);
   else if($action=="rm") rmm($data);
   else if($action=="copy") copym($data);
   else {
    error_log("Unknown action " . $action);
    echo '{"error":"action unknown", "detail":"$action"}';
   }
?>
