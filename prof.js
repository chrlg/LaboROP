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


function refreshList(){
    let $div=document.getElementById('list');
    mypost('ajax.php', {action:'listUser'}).then(function(j){
        $div.innerHTML='';
        for(let k of j){
            console.log(k);
            let d=document.createElement('div');
            $div.appendChild(d);
            d.textContent=k;
        }
    });
}

setInterval(refreshList, 2000);
