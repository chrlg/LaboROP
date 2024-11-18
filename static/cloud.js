// Client-side cloud functions

let currentFilename=false;
let pwd=false; // Directory for 'ls' (that is, user of files)
let listUsers=false; // list of all users of the system. false=unintialized or non available
let profGroupFilter='all';
let whoami=false;
let originalCode=false;

function setPwd(p){
    if(p=='0' || p==0) pwd=false;
    else pwd=p;
    if(pwd=='_Grimoire'){
        $ecrandroit.style.backgroundColor='#bbf';
    }else if(pwd){
        $ecrandroit.style.backgroundColor='#f88';
    }else{
        $ecrandroit.style.backgroundColor='#fff';
    }
}

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
    if(j.error){
        alert(j.msg);
        return;
    }
    if(currentFilename && currentFilename!=j.src){
        saveCode();
    }
    currentFilename=j.src;
    editor.setValue(j.code, -1);
    if(listUsers===false && j.who) editor.setReadOnly(true);
    originalCode=j.code;
    initFiles(j.who);
    //runCode();
}


// Called with response from "/save" command
function checkSavedCode(j){
    // If we are not logged in (session expired while we were working), we show login banner again, and save content
    // of editor in local storage
    if(j.error=='login'){
        document.getElementById('relogin').classList.add('show');
        if(currentFilename){
            localStorage.setItem("laborop_restore", JSON.stringify({"fn":currentFilename, "code":editor.getValue()}));
        }
        return;
    }
    // If save could not succeed for another reason, show why and do nothing
    if(j.error){
        alert(j.msg);
        return;
    }
    // If save was ok, erase restore from local storage (so that no unneeded files are created at next startup)
    if(j.saved=='ok'){
        localStorage.setItem("laborop_restore", JSON.stringify(false));
    }else{
        // Should never happen, but if it does, just in case, store in localstorage
        alert("Sauvegarde échouée");
        if(currentFilename){
            localStorage.setItem("laborop_restore", JSON.stringify({"fn":currentFilename, "code":editor.getValue()}));
        }
    }
}

function saveCode(run=false){
    // If we try to save code without a file (we typed code with an editor when no file were opened), then create a filename
    if(!currentFilename){
       let NOW = new Date();
       let NOWSTR = ""+(NOW.getYear()+1900)+"-"+(NOW.getMonth()+1)+"-"+(NOW.getDate())+"_"+(NOW.getHours())+":"+(NOW.getMinutes());
       currentFilename='New '+NOWSTR;
    }

    let code=editor.getValue();
    // Save only if needed
    if(code!=originalCode){
        mypost('/save', {who:pwd, fn:currentFilename, code:code}).then(checkSavedCode);
        originalCode=code;
    }

    if(run) runCode();
    return true;
}

function refreshCloud(rep){
    if(rep.error=='login'){
        document.getElementById('relogin').classList.add("show");
        return;
    }
    let restore=JSON.parse(localStorage.getItem("laborop_restore"));
    if(restore){
        setPwd(false);
        let NOW = new Date();
        let NOWSTR = ""+(NOW.getYear()+1900)+"-"+(NOW.getMonth()+1)+"-"+(NOW.getDate())+"_"+(NOW.getHours())+":"+(NOW.getMinutes());
        currentFilename=restore.fn+' Récupéré '+NOWSTR;
        editor.setValue(restore.code, -1);
        editor.setReadOnly(false);
        localStorage.setItem("laborop_restore", "false");
        return saveCode(false);
    }
    let tab='#files';
    if(rep.who=='_Grimoire') tab='#repository';
    $(tab).empty();
    let table=$("<table></table>").appendTo($(tab));
    if(listUsers && tab=='#files'){
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
            // When we change user, to be sure to not be unaware of what we write, unload file
            saveCode(false); // Save what we have
            setPwd(userSelect.val());
            currentFilename=false;
            originalCode='';
            editor.setValue('', -1);
            editor.setReadOnly(true); // No file is opened
            initFiles(pwd);
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
    let lf=rep.ls;
    let canwrite=false;
    if(listUsers || pwd===false) canwrite=true;
    for(let i=0; i<lf.length; i++){
        let fn=lf[i];
     
        // New row for file fn
        let tr=$("<tr></tr>").appendTo(table);
        let spanName=$("<span>"+fn+"</span>");  // File name
        if(fn==currentFilename) spanName.css("color", "red"); // Colored in red if we are editing this

        // ==== Field to rename it
        let inputName=$("<input />").val(fn).hide();  
        $("<td>").appendTo(tr).append(spanName).append(inputName);

        // Shows only when clicked on rename.
        inputName.keyup(function(e){
            if(e.keyCode===13){
                if(inputName.val()=="") return;
                let ns=inputName.val().replaceAll('/','╱');
                if(fn==currentFilename) currentFilename=ns;
                mypost('/mv', {who:pwd, src:fn, dest:ns}).then(function(j){
                    initFiles(pwd);
                });
            }
            if(e.keyCode===27){
                inputName.hide();
                spanName.show();
            }
        });

        // ==== Open button
        let btOpen=$("<button>Ouvrir</button>");
        $("<td>").appendTo(tr).append(btOpen);
        btOpen.click(function(){
            mypost('/load', {who:pwd, src:fn}).then(loadCloudFile);
            editor.setReadOnly(!canwrite);
        });


        // ==== Copy button. Create copy here if I can write, or in my own dir if not
        let btCopy=$("<button>Copier</button>");
        $("<td>").appendTo(tr).append(btCopy);
        btCopy.click(function(){
            mypost('/copy', {who:pwd, fn:fn}).then((j)=>initFiles(pwd));
        });

        // ==== Rename button : just show inputRename, and everything will be done there
        if(canwrite){
            let btRename=$("<button>Renommer</button>");
            $("<td>").appendTo(tr).append(btRename);
            btRename.click(function(){
                spanName.hide();
                inputName.show();
            });
        }

        // ==== Delete button
        if(canwrite){
            let btDel=$("<button>Supprimer</button>");
            $("<td>").appendTo(tr).append(btDel);
            btDel.click(function(){
                let sur=confirm("Supprimer le fichier "+fn+ " ?");
                if(!sur) return;
                mypost('/rm', {who:pwd, fn:fn}).then(function(j){
                    if(fn==currentFilename){
                        currentFilename=false;
                        originalCode='';
                        editor.setValue('', -1);
                        editor.setReadOnly(true); // Cannot edit file without opening one first
                    }
                    initFiles(pwd)
                });
            });
        }
    }

    // At the end of the file list, a field to create a new file
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
        if(currentFilename) saveCode();
        editor.setValue("", -1);
        editor.setReadOnly(false); // This one is a new file, we can edit it since we could create it
        originalCode="";
        currentFilename=ns;
        mypost('/save', {who:pwd, fn:currentFilename, code:editor.getValue()}).then((j)=>initFiles(pwd));
   });
}

function initFiles(who=false){
    setPwd(who);
    mypost("/ls", {who:pwd}).then(refreshCloud);
}


function lsUsers(){
    mypost('/lsUsers', {}).then(function(r){
        if(r.users) {
            listUsers=r.users;
            $beprof.style.opacity='1';
            $beprof.checked=true;
        }else{
            listUsers=false;
        }
        if(r.me) {
            whoami=r.me;
        }
        initFiles(pwd);
    });
}

function initCloud(){
    editor.setReadOnly(true) ; // Intialy nothing is opened. Will change as soon as we create/open a file
    lsUsers();

    $beprof.addEventListener('click', function(){
        let nstate="0";
        if($beprof.checked) nstate="1";
        mypost('/setProf', {prof:nstate}).then(function(){
            if(nstate=="0" && pwd!==false && pwd!="_Grimoire") setPwd(false);
            lsUsers(); // Implies `ls`
        });
    });
}

