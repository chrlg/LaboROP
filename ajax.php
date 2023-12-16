<?php 

header('Content-Type: application/json; charset=utf-8');
session_start();
ini_set("display_errors", 1);
ini_set("display_startup_errors", 1);
ini_set("error_log", "DB/ajaxerror.log");
error_reporting(E_ALL);

// Return true if $fn is an illegal filename for save. false otherwise
function illegal($fn){
    if(strpos($fn, ".")!==false) return true;
    if(strpos($fn, "/")!==false) return true;
    if(strpos($fn, "\\")!==false) return true;
    return false;
}

function error($a){
    global $action, $me;
    echo json_encode(array("action"=>$action, "me"=>$me, "error"=>$a));
    error_log("$action : $a me=$me");
    exit(0);
}


function ls(){
    global $prefix;
    if(!is_dir($prefix)) mkdir($prefix);
    if(!is_dir($prefix.'·Hist')) mkdir($prefix.'·Hist');
    chmod($prefix, 0775);
    chmod($prefix."·Hist", 0775);
    $rep=array();
    foreach(scandir($prefix) as $d){
        if($d=='.') continue;
        if($d=='..') continue;
        if($d=='·Hist') continue;
        array_push($rep, $d);
    }
    echo json_encode($rep);
}

function whoami(){
    global $me;
    echo json_encode(array("me"=>$me));
}

function mv($data){
    global $prefix;
    $src=$prefix.$data->src;
    $dest=$prefix.$data->dest;
    if(illegal($data->src) || illegal($data->dest)){
        error("illegal name $src $dest");
    }
    rename($src, $dest);
    error_log("mv success «${src}» «${dest}»");
    echo '{"ok":"ok"}';
}

function load($data){
    global $prefix;
    $src = $prefix.$data->src;
    if(illegal($data->src)){
        error("illegal name $src");
    }
    $txt = file_get_contents($src);
    $rep = array('src' => $data->src, 'code' => $txt);
    echo json_encode($rep);
}

function save($data){
    global $prefix;
    $fn=$prefix.$data->fn;
    if(illegal($data->fn)){
        error("Illegal name $fn");
    }
    if(is_file($fn)){
        copy($fn, $prefix."·Hist/".date("Y-m-d h:i:sa")."_".$data->fn);
    }
    $nb=file_put_contents($fn, $data->code);
    if(!$nb) {
        error("Could not save");
    }else{
        echo '{"saved":"ok"}';
    }
}

function rmm($data){
    global $prefix;
    $fn=$prefix.$data->fn;
    if(illegal($data->fn)){
        error("Illegal name $fn");
    }
    unlink($fn);
    echo '{"rm":"ok"}';
}

function copym($data){
    global $prefix;
    $fn=$prefix.$data->fn;
    if(illegal($data->fn)){
        error("Illegal name $fn");
    }
    copy($fn, $fn."(copie)");
    echo '{"copy":"ok"}';
    exit(0);
}


$json = file_get_contents('php://input');
$data = json_decode($json);

if(!isset($data->action)){
    echo '{"error":"no action"}';
    exit(0);
}
$action = $data->action;

if(!isset($_SESSION["clgme"])){
    echo '{"error":"login"}';
    exit(0);
}
$me = $_SESSION["clgme"];
$prefix = './DB/Root/' . $me . "/";


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
