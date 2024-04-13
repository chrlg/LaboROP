<?php 

header('Content-Type: application/json; charset=utf-8');
session_start();
ini_set("display_errors", 1);
ini_set("display_startup_errors", 1);
ini_set("error_log", "DB/ajaxerror.log");
error_reporting(E_ALL);

$ROOT = './DB/Root/';

function logActivity($what){
    global $me, $sql;
    $q=$sql->prepare('insert into activity (login, ts, what) values (:l, :t, :w)');
    $q->bindValue(':l', $me);
    $q->bindValue(':t', time());
    $q->bindValue(':w', $what);
    $q->execute();
}

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
    global $prefix, $prof, $ROOT, $sql;
    if(!is_dir($prefix)) mkdir($prefix);
    if(!is_dir($prefix.'·Hist')) mkdir($prefix.'·Hist');
    chmod($prefix, 0775);
    chmod($prefix."·Hist", 0775);
    $rep=array();
    if($prof){
        $l = $sql->query('SELECT distinct login,cn from Login order by sn');
        $users=array();
        while ($r = $l->fetchArray()){
            $login=$r['login'];
            $cn=$r['cn'];
            array_push($users, array($login, $cn));
        }
        array_push($rep, $users);
    }
    logActivity('ls');
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
    logActivity('mv');
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
    logActivity('load');
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
    logActivity('save');
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
    logActivity('rm');
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
    logActivity('copy');
    exit(0);
}

function listUser($data){
    global $prof, $prefix;
    if(!$prof) return;
    $sql = new SQLite3('DB/users.db');
    $ts=0;
    if(isset($data->ts)) $ts=$data->ts;
    $q = $sql->prepare('SELECT Login.login as l, cn, ip, max(activity.ts) as ta, max(Login.ts) as tl from Login, activity where l=activity.login AND activity.ts>:ts group by l order by ta');
    $q->bindValue(':ts', $ts);
    $r = $q->execute();
    $rep=array();
    while ($x = $r->fetchArray()){
        array_push($rep, array($x[0], $x[1], $x[2], time()-$x[3]));
    }
    echo json_encode($rep);
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
$sql = new SQLite3('DB/users.db');

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
else if($action=="listUser") listUser($data);
else {
    error_log("Unknown action " . $action);
    echo '{"error":"action unknown", "detail":"$action"}';
}
?>
