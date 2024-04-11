<?php 

header('Content-Type: application/json; charset=utf-8');
session_start();
ini_set("display_errors", 1);
ini_set("display_startup_errors", 1);
ini_set("error_log", "DB/ajaxerror.log");
error_reporting(E_ALL);

$ROOT = './DB/Root/';

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


function ls($data){
    global $prefix, $prof, $ROOT;
    if(!is_dir($prefix)) mkdir($prefix);
    if(!is_dir($prefix.'·Hist')) mkdir($prefix.'·Hist');
    error_log("ls chmod prefix=$prefix");
    chmod($prefix, 0775);
    chmod($prefix."·Hist", 0775);
    $rep=array();
    if($prof){
        $users=array();
        foreach(scandir($ROOT) as $d){
            if($d=='.' || $d=='..') continue;
            array_push($users, $d);
        }
        array_push($rep, $users);
    }
    $tdir=$prefix;
    foreach(scandir($tdir) as $d){
        if($d=='.') continue;
        if($d=='..') continue;
        if($d=='·Hist') continue;
        array_push($rep, $d);
    }
    echo json_encode($rep);
}

function whoami(){
    global $me, $prof;
    echo json_encode(array("me"=>$me, "prof"=>$prof));
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
    chmod($fn, 0664);
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
$prefix = $ROOT . $me . "/";
$prof = false;

if($me=='legal' || $me=='gaubert') $prof=true;

if($prof && isset($data->who) && ($data->who)){
    $prefix = $ROOT . ($data->who) . "/";
}

if($action=="ls") ls($data);
else if($action=="whoami") whoami($data);
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
