// Client-side cloud functions

let currentFilename=false;
let pwd=false; // Directory for 'ls' (that is, user of files)
let listUsers=false; // list of all users of the system. false=unintialized or non available
let profGroupFilter='all';

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

function loadCloudFile(j){
    currentFilename=j.src;
    editor.setValue(j.code, -1);
    initFiles();
    //runCode();
}


function checkSavedCode(j){
    if(j.error=='login'){
        document.getElementById('relogin').classList.add('show');
        if(currentFilename){
            localStorage.setItem("laborop_restore", JSON.stringify({"fn":currentFilename, "code":editor.getValue()}));
        }
        return;
    }
    if(j.saved=='ok'){
        localStorage.setItem("laborop_restore", JSON.stringify(false));
    }else{
        if(currentFilename){
            localStorage.setItem("laborop_restore", JSON.stringify({"fn":currentFilename, "code":editor.getValue()}));
        }
    }
}

function saveCode(run=false){
    if(!currentFilename){
       let NOW = new Date();
       let NOWSTR = ""+(NOW.getYear()+1900)+"-"+(NOW.getMonth()+1)+"-"+(NOW.getDate())+"_"+(NOW.getHours())+":"+(NOW.getMinutes());
       currentFilename='New '+NOWSTR;
    }
    mypost('/save', {who:pwd, fn:currentFilename, code:editor.getValue()}).then(checkSavedCode);
    if(run) runCode();
    return true;
}

function refreshCloud(lf){
    if(lf.error=='login'){
        document.getElementById('relogin').classList.add("show");
        return;
    }
    let restore=JSON.parse(localStorage.getItem("laborop_restore"));
    if(restore){
       let NOW = new Date();
       let NOWSTR = ""+(NOW.getYear()+1900)+"-"+(NOW.getMonth()+1)+"-"+(NOW.getDate())+"_"+(NOW.getHours())+":"+(NOW.getMinutes());
       currentFilename=restore.fn+' Récupéré '+NOWSTR;
       editor.setValue(restore.code, -1);
       localStorage.setItem("laborop_restore", "false");
       return saveCode(false);
    }
    let table=$("<table></table>").appendTo($("#files"));
    if(listUsers){
        let tr=$('<tr></tr>').appendTo(table);
        let td=$('<td colspan=4></td>').appendTo(tr);
        let userSelect=$('<select></select>').appendTo(td);
        $('<option value=0>ME</option>').appendTo(userSelect);
        let groupes={};
        for(let p of listUsers){
            if(!(p[2])) p[2]='Other';
            let o=$(`<option data-gid="${p[2]}" value=${p[0]}>${p[1]}</option>`).appendTo(userSelect);
            if(p[0]==pwd){
                o.attr('selected', 'selected');
            }
            if(groupes[p[2]]===undefined){
                groupes[p[2]]=true;
            }
        }
        let groupSelect=$('<select></select>').appendTo(td);
        $('<option value=all>All</option>').appendTo(groupSelect);
        let listGrp=Object.keys(groupes); listGrp.sort();
        for(let g of listGrp){
            let o=$(`<option value=${g}>${g}</option>`).appendTo(groupSelect);
            if(g==profGroupFilter) o.attr('selected', 'selected');
        }
        userSelect.change(function(e){
            pwd = userSelect.val(); 
            if(pwd=='0' || pwd==0) pwd=false;
            currentFilename=false;
            editor.setValue('', -1);
            initFiles();
        });
        let filterGroup=function(e){
            profGroupFilter=groupSelect.val();
            userSelect.find('option').hide();
            if(profGroupFilter=='all') userSelect.find('option').show();
            else userSelect.find(`option[data-gid="${profGroupFilter}"]`).show();
            userSelect.find('option[value=0]').show();
        };
        groupSelect.change(filterGroup);
        filterGroup();
        $('<a href="/static/prof.html">Activité</a>').appendTo(td);
    }
    for(let i=0; i<lf.length; i++){
        let fn=lf[i];
     
        let tr=$("<tr></tr>").appendTo(table);
        let spanName=$("<span>"+fn+"</span>");
        if(fn==currentFilename) spanName.css("color", "red");
        let inputName=$("<input />").val(fn).hide();
        $("<td>").appendTo(tr).append(spanName).append(inputName);
        let btOpen=$("<button>Ouvrir</button>");
        let btCopy=$("<button>Copier</button>");
        let btRename=$("<button>Renommer</button>");
        let btDel=$("<button>Supprimer</button>");
        $("<td>").appendTo(tr).append(btOpen);
        $("<td>").appendTo(tr).append(btCopy);
        $("<td>").appendTo(tr).append(btRename);
        $("<td>").appendTo(tr).append(btDel);
        btRename.click(function(){
            spanName.hide();
            inputName.show();
        });
        inputName.keyup(function(e){
            if(e.keyCode===13){
                if(inputName.val()=="") return;
                let ns=inputName.val().replaceAll('/','╱');
                if(fn==currentFilename) currentFilename=ns;
                mypost('/mv', {who:pwd, src:fn, dest:ns}).then(function(j){
                    initFiles();
                });
            }
            if(e.keyCode===27){
                inputName.hide();
                spanName.show();
            }
        });

        btOpen.click(function(){
            mypost('/load', {who:pwd, src:fn}).then(loadCloudFile);
        });

        btDel.click(function(){
            let sur=confirm("Supprimer le fichier "+fn+ " ?");
            if(!sur) return;
            mypost('/rm', {who:pwd, fn:fn}).then(function(j){
                if(fn==currentFilename){
                    currentFilename=false;
                    editor.setValue('', -1);
                }
                initFiles()
            });
        });
        btCopy.click(function(){
            mypost('/copy', {who:pwd, fn:fn}).then((j)=>initFiles());
        });
    }
    let tr=$("<tr>").appendTo(table);
    let inputNew=$("<input />");
    $("<td>").appendTo(tr).append(inputNew);
    let btNew=$("<button>Créer nouveau</button>");
    $("<td colspan=4>").appendTo(tr).append(btNew);

   
    btNew.click(function(){
        if(inputNew.val()==""){
            alert("Saisissez un nom d'abord");
            return;
        }
        let ns=inputNew.val().replaceAll('/','╱');
        for(let i=0; i<lf.length; i++){
            if(lf[i].name==ns){
                alert("Fichier déjà existant");
                return;
            }
        }
        editor.setValue("", -1);
        currentFilename=ns;
        mypost('/save', {who:pwd, fn:currentFilename, code:editor.getValue()}).then(initFiles);
   });
}

function initFiles(){
   $("#files").empty();
   mypost("/ls", {who:pwd}).then(refreshCloud);
   return;
}

function importPyroFile(txt){
    editor.setValue(txt, -1);
}


function initCloud(){
    mypost('/lsUsers', {}).then(function(r){
        if(r.users) listUsers=r.users;
    });
    initFiles();
}

