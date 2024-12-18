var editor;
var worker=false;
var workerRunning=false;
var workerInPause=false;
var Range;
var errorMarker=false;
var debugMarker=false;
var lastError;
var timeoutLen=120000;
var timeout=false;
var workerSleepTimeout=false;
var editorOptions=false;

var workerSab = new SharedArrayBuffer(16);
var workerSem = new Int32Array(workerSab);

function messageFromWorker(event){
    if(event.data.error){
        let e=event.data;
        let ln=e.ln;
        let $e=$("#errors");
        $e.append("<span>Line "+ln+" </span> : ");
        $e.append("<b>"+e.name+"</b><br>");
        if(e.msg) $e.append("<pre>"+e.msg+"</pre>");
        $e.append("<div>Consultez la documentation fournie par la fonction <b>help()</b></div>");
        errorMarker = editor.session.addMarker(new Range(ln-1, 0, ln-1, 999), "error", "line");
        lastError = e;
        setStateStop();
        workerRunning=false;
        if(timeout) clearTimeout(timeout); timeout=false;
        let $m=$("#misc")[0];
        $m.scrollTop=$m.scrollHeight;
        return;
    }
    if(event.data.print){
        $("#console").text(event.data.print);
        let $m=$("#misc")[0];
        $m.scrollTop=$m.scrollHeight;
        return;
    }
    if(event.data.graph){
        updateGraph(event.data.graph);
        return;
    }
    if(event.data.mapres){
        $("#svgcont").hide();
        $("#canvascont").show();
        showReseau(event.data.mapres, event.data.arcs, event.data.name, event.data.bound, event.data.arrow);
        return;
    }
    if(event.data.progress){
        setProgress(event.data.progress);
        return;
    }
    if(event.data.status){
        setUserStatus(event.data.status, event.data.color);
        return;
    }
    if(event.data.sleep){
        if(workerSleepTimeout) clearTimeout(workerSleepTimeout); // Should be useless
        workerSleepTimeout = setTimeout(function(){
            Atomics.store(workerSem,0,1); 
            Atomics.notify(workerSem,0);
            workerSleepTimeout=false;
        }, event.data.sleep);
        return;
    }
    if(event.data.breakpoint){
        // We don't kill programs while they are debugged!
        if(timeout) clearTimeout(timeout); timeout=false;
        let ln=event.data.ln;
        debugMarker = editor.session.addMarker(new Range(ln-1, 0, ln-1, 999), "debug", "line");
        showDebugInfo(event.data.breakpoint);
        setStatePause();
        return;
    }
    if(event.data.debugInfo){
        //Future -> show debug info for a specifc request
        //Console.log("info", event.data.debugInfo, event.data.row, event.data.col);
        return;
    }
    if(event.data.termine!==undefined){
        $("#status").html("<i>Program terminé avec le code "+event.data.termine+" en "+event.data.opcnt+" opérations</i>");
        if(timeout) clearTimeout(timeout); timeout=false;
        setStateStop();
        workerRunning=false;
        let $m=$("#misc")[0];
        $m.scrollTop=$m.scrollHeight;
    }
}

function resetMarkers(){
    if(debugMarker) {
        editor.session.removeMarker(debugMarker);
        debugMarker=false;
    }
    if(errorMarker){
        editor.session.removeMarker(errorMarker);
        errorMarker=false;
    }
}

function resumeBreak(lvl){
    Atomics.store(workerSem,0,lvl); 
    Atomics.notify(workerSem,0);
    setStateRunning();
    resetMarkers();
    if(timeout) clearTimeout(timeout); // Defensive: we have cancelled it when we broke
    timeout=setTimeout(function(){timeout=false; Terminate();}, timeoutLen); // That means that a code that last 1m59 before breakpoint, can get 2 brand new minutes of run
                        // But user is expected to know what they do in such case 
}

// Terminate only if something is running (called when a new file is opened to end current run, if there is one)
function StopProcess(){
    if(workerRunning) Terminate();
}

function endWorker(){
    if(!worker) return;
    if(timeout) clearTimeout(timeout);
    timeout=false;
    worker.terminate();
    worker=false;
    workerRunning=false;
    resetMarkers();
}

function startWorker(){
    endWorker(); // End current worker if there is one
    worker = new Worker("interpret.js", {type:"module"});
    workerRunning=false;
    worker.onmessage = messageFromWorker;
    worker.onerror = (e) => {
        // Shouldn't happen (language error are conveyed in normal data.error messages).
        // So, in doubt, kill the worker, and don't restart it yet (to avoid loops if the error was at startup)
        // By setting worker to false, we ensure that another start will be attempted next time we click on start
        console.log('error received by worker', e); 
        endWorker();
    };
    worker.postMessage({pausesab:workerSab});
}

// Start worker in advance for future code run
startWorker();

function runCode(){
    if(timeout) clearTimeout(timeout);
    timeout=false;
    // If there is no worker, or if there is already a running code, kill the former worker and start a new one
    // (only case where !worker, is because there was an internal error previous time and we dare not start it again immediatly
    // Otherwise, we start workers as soon as we end the previous one, so that it is already there to run code
    // (it avoids 1/2 second delay, approx, of starting time)
    if((!worker) || workerRunning) startWorker(); 
    let argv=[currentSource.fn];
    if($argv.value!='') argv=argv.concat($argv.value.split(' '));
    workerRunning=true;
    if(workerSleepTimeout) clearTimeout(workerSleepTimeout);
    workerSleepTimeout=false;
    Atomics.store(workerSem,0,1); // In case we ended previous run while in waiting state
    worker.postMessage({argv: argv});
    worker.postMessage({code:editor.getValue()});
    setStateRunning();
    timeout=setTimeout(function(){timeout=false; Terminate();}, timeoutLen);
    $("#console").empty();
    $("#status").empty();
    $("#errors").empty();
    $("#svgcont").empty();
    $extragraph.innerHTML='';
    setProgress(0);
    setUserStatus('');
    $tabs.classList.remove('multextra');
    _graphes={Gr:true};
    resetMarkers();
    return true;
}

function Terminate(){
    if(timeout) clearTimeout(timeout);
    if(workerSleepTimeout) clearTimeout(workerSleepTimeout);
    workerSleepTimeout=false;
    timeout=false;
    // Start a new worker (and, more importantly here, kill the former one
    // but starting a new one — not running — make it ready for next code run)
    startWorker(); 
    setStateStop();
    closeDebugInfo();
    resetMarkers();
    $("#status").html("<i>Programme en boucle, interrompu au bout de "+(timeoutLen/1000)+" secondes</i>");
}

function checkEditorSettings(){
    const tocheck=["fontSize"];
    // There are 3 places where options are stored : localStorage, editorOptions variable, and editor.get/setOption API
    // 1st one is where we store persistent values
    // 2nd is a localVariable whose main purpose is to detect changes in editor
    // 3rd is the one actually used by the editor, and the one changed by ctrl+, panel

    if(!editorOptions){
        // First time we check this. Anything in localStorage is set both in editorOptions and in editor.setOption
        // Anything not in localStorage is taken from default value of editor.getOption
        editorOptions={};
        for(let opt of tocheck){
            let fromstore=localStorage.getItem('Rop-Ace-'+opt);
            if(fromstore){
                editorOptions[opt] = fromstore;
                editor.setOption(opt, fromstore);
            }else{
                localStorage.setItem('Rop-Ace-'+opt, editor.getOption(opt));
                editor[opt] = editor.getOption(opt);
            }
        }
    }else{
        // Otherwise, we check for any differences between editor.getOption and editorOptions
        // If there is one (despite the intial values being equal), that means that option has changed (using ctrl+,) since
        // reflect that change on localStorage for next time
        for(let opt of tocheck){
            let op=editor.getOption(opt);
            if(op!=editorOptions[opt]){
                editorOptions[opt] = op
                localStorage.setItem('Rop-Ace-'+opt, op);
            }
        }
    }
}

function mouseMove(e){
    if(!workerInPause) return;
    /*
    let pos=e.getDocumentPosition();
    Atomics.store(workerSem, 1, pos.row);
    Atomics.store(workerSem, 2, pos.column);
    Atomics.store(workerSem, 0, 3); // I want debug info on that pos
    Atomics.notify(workerSem, 0);
    */
}

function init(){

   // Ace init
   Range = ace.require('ace/range').Range;
   editor = ace.edit("editor");
   editor.setTheme("ace/theme/monokai");
   editor.getSession().setMode("ace/mode/python");
   editor.setShowPrintMargin(false);
   editor.$blockScrolling = Infinity;
   editor.getSession().setTabSize(3);
   // Hors sujet :
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["alt-e"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["alt-shift-e"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["alt-0"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-s"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-shift-/"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-["];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-]"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["alt-shift-x"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-u"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-shift-u"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-up"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-down"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-shift-up"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-shift-down"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-shift-left"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-shift-right"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-right"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-left"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-l"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-a"];

   editor.commands.addCommand({name:"ShowGraph", bindKey:{win:"alt-g",mac:"Alt-g"},
         exec:()=>{showTab("show");}});
   editor.commands.addCommand({name:"ShowFiles", bindKey:{win:"alt-f",mac:"Alt-f"},
         exec:()=>{showTab("files");}});
   editor.commands.addCommand({name:"Stop", bindKey:{win:"alt-c",mac:"Alt-c"},
         exec:()=>{Terminate();}});
   editor.commands.addCommand({name:"Save&Run", 
         bindKey:{win:"Ctrl-s", mac:"Command-s"}, exec:()=>saveCode(true)});
   editor.commands.addCommand({name:"Run", 
         bindKey:{win:"Alt-r", mac:"Command-Alt-r"}, exec:runCode});
   editor.commands.addCommand({name: "showKeyboardShortcuts",
         bindKey: {win: "Ctrl-Alt-h", mac: "Command-Alt-h"},
         exec: function(editor) {
            ace.config.loadModule("ace/ext/keybinding_menu", function(module) {
               module.init(editor);
               editor.showKeyboardShortcuts()
            })
         }
   });

    //editor.getSession().on('change', oneditorChange);
    editor.setOption("showInvisibles", true);

    // Check for options in localStorage. And do that again anytime we get focus (presumably going back from ctrl+,)
    editor.on('focus', checkEditorSettings);
    checkEditorSettings();

    editor.on('mousemove', mouseMove);

    initGui();

   // Fichiers
   initCloud();

   // Zoom dans show
   $("#show").bind("mousewheel DOMMouseScroll", function(e){
      if(!e.altKey) return;
      let ee=e.originalEvent;
      let delta=ee.detail?ee.detail:ee.deltaY;
      doZoom(delta);
      e.preventDefault();
      return false;
   });

   setInterval(refreshGraphs, 500);
}

window.onload=init;
