// File containing all GUI aspect (buttons, divs and stuff. With exclusion of drawings, in srendering)

let $extragraph, $tabs, $unrollExtragraph;
let $progress, $progressval, $userStatus;
let $run, $stop, $resume, $argv;
let $debugInfo, $debugInfoContent, $debugInfoClose, $debugInfoHandle;
let $ecrandroit;
let $beprof;

function showTab(t, button=false){
    $(".show").removeClass("selected");
    $("#"+t).addClass("selected");
    $("#tabs button").removeClass("selected");
    if(button) button.addClass("selected");
    else $("#tabs button[data-target='"+t+"']").addClass("selected");
    if(t=='files') initFiles(false);
    else if(t=='repository') initFiles('_Grimoire');
    if(t=='show' && button.attr('data-graph')){
        let gname=button.attr('data-graph');
        _graphes[gname].shown=false;
        refreshGraphs();
    }
}

// Initialise callbacks for split handles that allows to change relative size of gui main boxes
function splitMove(){
   function changeSplit(svw){
      $("#ecrangauche").css("width", ""+svw+"vw");
      $("#splithandle").css("left", ""+svw+"vw");
      $("#ecrandroit").css("left", "calc("+svw+"vw + 6px)");
      $("#ecrandroit").css("width", "calc("+(100-svw)+"vw - 6px)");
   }
   function changeSplitD(svh){
      $("#hautdroit").css("height", ""+(svh-4)+"vh");
      $("#splithandled").css("top", ""+svh+"vh");
      $("#misc").css("top", "calc("+svh+"vh + 4px)");
   }

   let winit=false, hinit=false;
   $("#splithandle").mousedown(function(e){
      winit=$("body").width();
      e.preventDefault();
      return false;
   });
   $("#splithandled").mousedown(function(e){
      hinit=$("#ecrandroit").height();
      e.preventDefault();
      return false;
   });
   $(document).mousemove(function(e){
      if(winit) changeSplit(e.clientX*100.0 / winit);
      else if(hinit) changeSplitD(e.clientY*100.0 / hinit);
   });
   $(document).mouseup(function(e){
      winit=false;
      hinit=false;
   });
}

function setProgress(x){
    if(x<0 || x>1){
        $progress.classList.add('over');
        $progress.style.right="0vw";
        $progressval.textContent = ''+x;
    }else{
        $progress.classList.remove('over');
        $progress.style.right = `${9-x*9}vw`;
        $progressval.textContent = (x*100).toFixed(2)+'%';
    }
}

function setUserStatus(t, col){
    if(col) $userStatus.style.color=col;
    $userStatus.textContent=t;
}

function setStateRunning(){
    $run.disabled=true;
    $run.style.display="inline";
    $stop.disabled=false;
    $resume.style.display="none";
    workerInPause=false;
}
function setStateStop(){
    $run.disabled=false;
    $run.style.display="inline";
    $stop.disabled=true;
    $resume.style.display="none";
    workerInPause=false;
}

function setStatePause(){
    $run.disabled=false;
    $run.style.display="none";
    $stop.disabled=false;
    $resume.style.display="inline";
    workerInPause=true;
}

function makeMovable(handle, win){
    let xpos0=false, ypos0, xptr0, yptr0;
    handle.addEventListener('mousedown', function(e){
        let re=$debugInfo.getBoundingClientRect();
        xpos0=re.x;
        ypos0=re.y;
        xptr0=e.clientX;
        yptr0=e.clientY;
        e.preventDefault();
        return false;
    });

    document.addEventListener('mouseup', function(e){
        xpos0=false;
        e.preventDefault();
        return false;
    });

    document.addEventListener('mousemove', function(e){
        if(xpos0===false) return;
        $debugInfo.style.left = (e.clientX-xptr0+xpos0).toFixed(2)+'px';
        $debugInfo.style.top = (e.clientY-yptr0+ypos0).toFixed(2)+'px';
    });
}

function closeDebugInfo(){
    $debugInfo.style.display='';
}

function addEnvTable(name, e){
    let table=document.createElement('table');
    table.classList.add('debugInfoEnv');
    table.innerHTML=`<thead><tr class=title><th colspan=3>${name}</th></tr><tr><th>Variable<th>Type<th>Valeur</tr></thead>`;
    $debugInfoContent.appendChild(table);
    let body=document.createElement('tbody');
    let s='';
    for(let k in e){
        s+=`<tr><th>${k}<td>${e[k][0]}<td>${e[k][1]}`;
    }
    body.innerHTML=s;
    table.appendChild(body);
}

function showDebugInfo(info){
    $debugInfo.style.display='inline-block';
    $debugInfoContent.innerHTML='';
    if(info.global){
        addEnvTable("Environnement global", info.global);
    }
    for(let e of info.stack){
        addEnvTable("Environnement local", e);
    }
}

function initGui(){
    // Some global vars for dom quick access (objective : no jquery)
    $extragraph=document.getElementById('extragraph');
    $tabs=document.getElementById('tabs');
    $unrollExtragraph=document.getElementById('unrollExtragraph');
    $progress=document.getElementById('progress');
    $progressval=document.getElementById('progressval');
    $userStatus=document.getElementById('userStatus');
    $stop=document.getElementById('stop');
    $run=document.getElementById('run');
    $resume=document.getElementById('resume');
    $argv=document.getElementById('argv');
    $ecrandroit=document.getElementById('ecrandroit');
    $beprof=document.getElementById('beprof');
    $debugInfoClose=document.getElementById('debugInfoClose');
    $debugInfo=document.getElementById('debugInfo');
    $debugInfoContent=document.getElementById('debugInfoContent');
    $debugInfoHandle=document.getElementById('debugInfoHandle');

    // Initialise split handlers
    splitMove();

    // Tabs
    $("#tabs button[data-target]").click(function(e){
        let t=$(this).attr("data-target");
        showTab(t, $(this));
        $extragraph.classList.remove('unrolled');
    });
    $("#tabs button[data-target='show']").click(function() {
        refreshGraphs();
    });

    $unrollExtragraph.addEventListener('click', function(){
        $extragraph.classList.toggle('unrolled');
        // Set position to the one of $unrollExtragraph button
        // Note: void if not multgraph (since then position is not absolute)
        $extragraph.style.left=($unrollExtragraph.getBoundingClientRect().x-$unrollExtragraph.parentElement.getBoundingClientRect().x).toFixed(2)+'px';
        //showTab('show');
    });

    // Run/stop
    $run.addEventListener('click', function(){saveCode(true);});
    $stop.addEventListener('click', function(){if(timeout) clearTimeout(timeout); timeout=false; Terminate();});
    $resume.addEventListener('click', function(){resumeBreak(1);});

    // Debug window
    $debugInfoClose.addEventListener('click', function(){ resumeBreak(2); closeDebugInfo();} );
    makeMovable($debugInfoHandle, $debugInfo);

    // Start with nothing running
    setStateStop();
}
