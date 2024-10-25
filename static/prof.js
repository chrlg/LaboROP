let $salle = document.getElementById('salle');
let $groupe = document.getElementById('groupe');
let $lastAct = document.getElementById('lastAct');
let $actionMaintenance = document.getElementById('actionMaintenance');
let $list=document.getElementById('list');

function mypost(url,payload){
    return fetch(url, {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(function(res){
        return res.json();
    });
}

// 192.168.218.66 Wifi
function createUserDiv(cn, ipname, act, x, y){
    let d=document.createElement('div');
    d.classList.add('user');
    let $cn=document.createElement('b');
    $cn.textContent=cn;
    d.appendChild($cn);
    let $ip=document.createElement('span');
    $ip.textContent=ipname;
    d.appendChild($ip);
    if(act<30){
        d.classList.add('act30');
    }else if(act<300){
        d.classList.add('act300');
    }else if(act<5400){
        d.classList.add('actUC');
    }else{
        d.classList.add('actOld');
    }
    d.setAttribute('title', `Dernière activité il y a ${(act/60).toFixed(1)} minutes`);
    if(x!==false && x!==null){
        d.classList.add('plan');
        d.style.top=(y*16).toFixed(0)+'vh';
        d.style.left=(x*13).toFixed(0)+'vw';
    }

    return d;
}

function refreshList(){
    let ts=parseInt($lastAct.value);
    if(isNaN(ts)) ts=5400;
    let salle=$salle.value;
    let gid=$groupe.value;

    // Recherche par salle
    if(salle!='-'){
        mypost('/activityRoom', {room:salle, limit:ts}).then(receiveActivity);
    }else if(gid!='-'){
        mypost('/activityGroup', {group:gid, limit:ts}).then(receiveActivity);
    }else{
        mypost('/activityGroup', {group:null, limit:ts}).then(receiveActivity);
    }
}

function receiveActivity(j){
    $list.innerHTML='';
    for(let k of j){
        let d=createUserDiv(k[0], k[1], k[2], k[3], k[4]);
        $list.appendChild(d);
    }
}

mypost('/listRooms', {}).then(function(rep){
    for(let room of rep){
        let oo=document.createElement('option');
        oo.value=room;
        oo.textContent=room;
        $salle.appendChild(oo);
    }
})

mypost('/listGroups', {}).then(function(rep){
    for(let gr of rep){
        console.log(gr);
        let oo=document.createElement('option');
        oo.value=gr;
        oo.textContent=gr;
        $groupe.appendChild(oo);
    }
})

setInterval(refreshList, 20000);
refreshList();
document.getElementById('refresh').addEventListener('click', refreshList);
$salle.addEventListener('change', function(){ $groupe.value='-'; refreshList();});
$groupe.addEventListener('change', function(){ $salle.value='-'; refreshList();});
$lastAct.addEventListener('blur', refreshList);
$lastAct.addEventListener('keyup', function(e){
    if(e.code=='Enter') refreshList();
});
