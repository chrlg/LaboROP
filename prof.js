let $lastAct = document.getElementById('lastAct');
let $methTri = document.getElementById('methTri');
let $salle = document.getElementById('salle');

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
function createUserDiv(cn, ip, name, act){
    let d=document.createElement('div');
    d.classList.add('user');
    let $cn=document.createElement('b');
    $cn.textContent=cn;
    d.appendChild($cn);
    let $ip=document.createElement('span');
    if(name){
        $ip.textContent=name;
    }else{
        $ip.textContent=ip;
    }
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
    return d;
}

function refreshList(){
    let $div=document.getElementById('list');
    let ts=parseInt($lastAct.value);
    if(isNaN(ts)) ts=1000000000;
    let salle=$salle.value;
    mypost('ajax.php', {action:'listUser', ts:ts}).then(function(j){
        $div.innerHTML='';
        if($methTri.value=='ip') j.sort(function(a,b){ if(a[2]>b[2]) return 1; else return -1;});
        else if($methTri.value=='name') j.sort(function(a,b){ if(a[5]>b[5]) return 1; else return -1;});
        for(let k of j){
            if(salle!='*' && (k[4]==null || k[4].substring(0, salle.length)!=salle)) continue;
            let d=createUserDiv(k[1], k[2], k[4], k[3]);
            $div.appendChild(d);
        }
    });
}

setInterval(refreshList, 20000);
refreshList();
document.getElementById('refresh').addEventListener('click', refreshList);
