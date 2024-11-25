// Client-side cloud functions

let currentSource=false; // source for the current opened file. false if no file is opened. A triplet {fn: filename, who: userorFalseForMe, code: intialValue
                         // of code}
let pwd=false; // Directory for 'ls' (that is, user of files)
let listUsers=false; // list of all users of the system. false=unintialized or non available (false also means you are not a teacher)
let profGroupFilter='all'; // Current group filter for user <select> in teacher file interface
let whoami=false; // For now, serves no purpose. But is updated when we know the value

// Update currently opened file with new filename, directory (who. false=me), original code (currently saved content), and flag telling if we can modify that
function setSource(fn, who, orgcode, readonly=false){
    if(fn===false){
        // Close file. And since no file is opened, switch to read-only mode
        currentSource=false;
        editor.setReadOnly(true);
        editor.setValue('', -1);
    }else{
        currentSource = {fn:fn, who:who, code:orgcode};
        editor.setReadOnly(readonly);
    }
    // Currently edited code if ours (or none)
    if(fn===false || who===false){
        $ecrandroit.style.backgroundColor='#fff';
        $ecrandroit.style.backgroundImage='';
    }else if(who=='_Grimoire'){
        $ecrandroit.style.backgroundColor='';
        $ecrandroit.style.backgroundImage='URL("oldpaper.jpg")';
    }else{
        $ecrandroit.style.backgroundColor='#f88';
        $ecrandroit.style.backgroundImage='';
    }
}

function setPwd(p){
    if(p=='0' || p==0) pwd=false;
    else pwd=p;
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
    // If there is already a file opened, and it is different of the one we received, save code (if needed, but that is handled in saveCode)
    // before replacing editor content with what we received
    if(currentSource && (currentSource.fn!=j.src || currentSource.who!=j.who)){
        saveCode();
    }
    // Set source of just received file. It is readonly iff user is not teacher and edited code is not his (so Grimoire, since non-teacher can't edit
    // other can than theirs and Grimoire)
    setSource(j.src, j.who, j.code, (listUsers===false) && (j.who!==false));
    editor.setValue(j.code, -1);
    initFiles(j.who);
    //runCode();
}


// Called with response from "/save" command
function checkSavedCode(j){
    // If we are not logged in (session expired while we were working), we show login banner again, and save content
    // of editor in local storage
    if(j.error=='login'){
        document.getElementById('relogin').classList.add('show');
        let code=editor.getValue();
        // If a file was opened, and modified (and therefore, where we can write it), then save code to local storage
        // for future restore
        if(currentSource && currentSource.code!=code){
            localStorage.setItem("laborop_restore", JSON.stringify({"fn":currentSource.fn, "code":code}));
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
        if(currentSource){
            localStorage.setItem("laborop_restore", JSON.stringify({"fn":currentSource.fn, "code":editor.getValue()}));
        }
    }
}

function saveCode(run=false){
    // If we try to save code without a file (we typed code with an editor when no file were opened), then create a filename
    // Note that this should now be impossible, since editor is read-only unless we selected a file
    if(!currentSource){
       let NOW = new Date();
       let NOWSTR = ""+(NOW.getYear()+1900)+"-"+(NOW.getMonth()+1)+"-"+(NOW.getDate())+"_"+(NOW.getHours())+":"+(NOW.getMinutes());
       // source (that is where we would save it, since that source is invented here) is constructed filename on our dir, 
       // with org code='' (to force next save of anything non empty), and is not read-only
       setSource('New '+NOWSTR, false, '', false);
    }

    let code=editor.getValue();
    // Save only if needed
    if(code!=currentSource.code){
        mypost('/save', {who:currentSource.who, fn:currentSource.fn, code:code}).then(checkSavedCode);
        currentSource.code=code; // Keep track of what is saved
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
        // code is '' in source so that next attempt to save actually saves even if we change nothing (unless, of course, file is empty)
        setSource(restore.fn+' Récupéré '+NOWSTR, false, '', false);
        editor.setValue(restore.code, -1);
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
            setSource(false); // close file
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
        if(fn==currentSource.fn && pwd==currentSource.who) spanName.css("color", "red"); // Colored in red if we are editing this

        // ==== Field to rename it
        let inputName=$("<input />").val(fn).hide();  
        $("<td>").appendTo(tr).append(spanName).append(inputName);

        // Shows only when clicked on rename.
        inputName.keyup(function(e){
            if(e.keyCode===13){
                if(inputName.val()=="") return;
                let ns=inputName.val().replaceAll('/','╱');
                // If we renamed the file currently opened, also change the name in currentSource (used as a target for future saves)
                if(currentSource && fn==currentSource.fn && pwd==currentSource.who) currentSource.fn=ns;
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
                    // If we remove the file currently opened, close it (empty editor...)
                    if(fn==currentSource.fn && pwd==currentSource.who){
                        setSource(false);
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
        if(currentSource) saveCode();
        editor.setValue("", -1);
        // This is the new edited file, on currently watched dir, with no code, and writable
        setSource(ns, pwd, '', false);
        mypost('/save', {who:pwd, fn:ns, code:''}).then((j)=>initFiles(pwd));
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

