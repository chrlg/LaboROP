var editor;
var worker;
var Range;
var errorMarker=false;
var lastError;
var timeoutLen=120000;

var _grlg = {
   svgw:false,
   svgh:false,
   zoomlv:0,
};

var _graphes={"Gr":true};
let _graphRendererRunning=false;

var timeout=false;
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
        worker=false;
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
    if(event.data.termine!==undefined){
        $("#status").html("<i>Program terminé avec le code "+event.data.termine+" en "+event.data.opcnt+" opérations</i>");
        worker=false;
        if(timeout) clearTimeout(timeout); timeout=false;
        let $m=$("#misc")[0];
        $m.scrollTop=$m.scrollHeight;
    }
    if(event.data.store){
        window[event.data.name]=event.data.store;
    }
}

function oneditorChange(e){
}

let eee=0;
function runCode(){
    if(worker) worker.terminate();
    if(timeout) clearTimeout(timeout);
    worker=false;
    worker = new Worker("interpret.js", {type:"module"});
    worker.onmessage = messageFromWorker;
    worker.onerror = (e) => {eee=e; console.log(e);};
    worker.postMessage(editor.getValue());
    timeout=setTimeout(Terminate, timeoutLen);
    $("#console").empty();
    $("#status").empty();
    $("#errors").empty();
    $("#svgcont").empty();
    $("#extragraph").empty();
    _graphes={Gr:true};
    if(errorMarker){
        editor.session.removeMarker(errorMarker);
        errorMarker=false;
    }
    return true;
}

let currentFilename=false;
let pwd=false; // Directory for 'ls' (that is, user of files)
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
    mypost('ajax.php', {action:'save', who:pwd, fn:currentFilename, code:editor.getValue()}).then(checkSavedCode);
    if(run) runCode();
    return true;
}

function Terminate(){
    timeout=false;
    if(worker) worker.terminate();
    worker=false;
    $("#status").html("<i>Programme en boucle, interrompu au bout de "+(timeoutLen/1000)+" secondes</i>");
}

function zoomGraph(){
    let targetscale = 1.1**_grlg.zoomlv;
    let targetw = _grlg.svgw*targetscale;
    let targeth = _grlg.svgh*targetscale;
    let winw = $("#svgcont").width();
    let winh = $("#svgcont").height();
    if (targetw<winw) targetw=winw;
    if (targeth<winh) targeth=winh;
    $("#svgcont svg").width(targetw).height(targeth);
    $("#canvascont canvas").width(targetscale*1000).height(targetscale*1000);
    let grname=$(`#tabs button.selected`).attr("data-graph");
    if(grname && _graphes[grname] && _graphes[grname].mode=="map") {
        _graphes[grname].shown=false;
        refreshGraphs();
    }
}

function updateGraph(gr){
    if(!_graphes[gr.name]){
        createExtraGraph(gr.name);
    }
    _graphes[gr.name]=gr;
    gr.shown=false;
    refreshGraphs();
}

function refreshGraphs(){
    if(_graphRendererRunning) return;
    for(let k in _graphes){
        let gr=_graphes[k];
        if(gr.shown) continue;
        if($(`#tabs button.selected[data-graph="${gr.name}"]`).length){
            showGraph(gr);
            gr.shown=true;
        }
    }
}

function createExtraGraph(name){
    let $but=$(`<button data-graph="${name}">${name}</button>`);
    $("#extragraph").append($but);
    $but.click(function(){
        showTab("show", $but);
    });
}

function showGraph(g){
    if(g===true){
        $('#svgcont').hide();
        $('#canvascont').hide();
        return;
    }
    if(g.mode=='dot'){
        _graphRendererRunning=true;
        let dot=generateDot(g);
        let viz=Viz(dot);
        $('#svgcont').show();
        $('#canvascont').hide();
        $('#svgcont').html(viz);
        _grlg.svgw = $("#svgcont svg").width();
        _grlg.svgh = $("#svgcont svg").height();
        zoomGraph();
        _graphRendererRunning=false;
        return;
    }
    if(g.mode=='map'){
        _graphRendererRunning=true;
        $('#svgcont').hide();
        $('#canvascont').show();
        showMap(g);
        _graphRendererRunning=false;
        return;
    }
    if(g.mode=='mesh'){
        _graphRendererRunning=true;
        let dot=generateDot(g);
        let viz=Viz(dot, {"engine":"neato"});
        $('#svgcont').show();
        $('#canvascont').hide();
        $('#svgcont').html(viz);
        _grlg.svgw = $("#svgcont svg").width();
        _grlg.svgh = $("#svgcont svg").height();
        zoomGraph();
        _graphRendererRunning=false;
        return;
    }
}

function showMap(g){
    let targetscale = 1.1**_grlg.zoomlv;
    let cv=$("#canvascont canvas")[0];
    let ctx=cv.getContext("2d");
    ctx.clearRect(0, 0, 4000, 4000);
    ctx.strokeStyle="#000";
    ctx.lineWidth=4.0/targetscale;
    let xmin=1e20, xmax=-1e20, ymin=1e20, ymax=-1e20;
    for(let i in g.sommets){
        let s=g.sommets[i];
        if(s.x<xmin) xmin=s.x;
        if(s.x>xmax) xmax=s.x;
        if(s.y<ymin) ymin=s.y;
        if(s.y>ymax) ymax=s.y;
    }
    let AX=4000/(xmax-xmin)*0.99;
    let BX=(-xmin+(xmax-xmin)*0.005)*AX;
    let AY=4000/(ymax-ymin)*0.99;
    let BY=(-ymin+(ymax-ymin)*0.005)*AY;
    for(let a of g.arcs){
        if(g.discover && !a.visible) continue;
        let x1=AX*g.sommets[a.i].x+BX;
        let y1=AY*g.sommets[a.i].y+BY;
        let x2=AX*g.sommets[a.a].x+BX;
        let y2=AY*g.sommets[a.a].y+BY;
        ctx.beginPath();
        if(a.color){
            ctx.strokeStyle=a.color;
            ctx.lineWidth=12.0/targetscale;
        }
        else {
            ctx.strokeStyle="#000";
            ctx.lineWidth=4.0/targetscale;
        }
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
    }
}

function showMesh(g){
    let targetscale = 1.1**_grlg.zoomlv;
    let cv=$("#canvascont canvas")[0];
    let ctx=cv.getContext("2d");
    ctx.clearRect(0, 0, 4000, 4000);
    ctx.strokeStyle="#000";
    ctx.lineWidth=4.0/targetscale;
    let xmin=1e20, xmax=-1e20, ymin=1e20, ymax=-1e20;
    for(let i in g.sommets){
        let s=g.sommets[i];
        if(s.x<xmin) xmin=s.x;
        if(s.x>xmax) xmax=s.x;
        if(s.y<ymin) ymin=s.y;
        if(s.y>ymax) ymax=s.y;
    }
    let r=80/targetscale;
    let AX=4000/(xmax-xmin+2*r);
    let BX=(-xmin+r)*AX;
    let AY=4000/(ymax-ymin+2*r);
    let BY=(-ymin+r)*AY;

    let font1=''+(r*1.1)+'px sans';
    let font2=''+(r*0.7)+'px sans';
    let arcLblSize=r*0.25;
    let nodeSize=(g.oriented)?(r/10):r;

    for(let a of g.arcs){
        if(g.discover && !a.visible) continue;
        let x1=AX*g.sommets[a.i].x+BX;
        let y1=AY*g.sommets[a.i].y+BY;
        let x2=AX*g.sommets[a.a].x+BX;
        let y2=AY*g.sommets[a.a].y+BY;
        ctx.beginPath();
        if(a.color){
            ctx.strokeStyle=a.color;
            ctx.lineWidth=12.0/targetscale;
            ctx.fillStyle=a.color;
        }
        else {
            ctx.strokeStyle="#000";
            ctx.lineWidth=4.0/targetscale;
            ctx.fillStyle=a.color;
        }
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
        let xm=(x1+x2)/2;
        let ym=(y1+y2)/2;
        ctx.moveTo(x1,y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
        if(g.oriented){
            // cos(30) -sin(30)  |  x1-x2
            // sin(30) cos(30)   |  y1-y2
            let fc=0.7*r/Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
            ctx.moveTo(x2,y2);
            ctx.lineTo(fc*(0.94*(x1-x2)-0.342*(y1-y2))+x2, fc*(0.94*(y1-y2)+0.342*(x1-x2))+y2);
            ctx.lineTo(fc*(0.94*(x1-x2)+0.342*(y1-y2))+x2, fc*(0.94*(y1-y2)-0.342*(x1-x2))+y2);
            ctx.fill();
        }
        if(a.label){
            ctx.font=font2;
            ctx.fillText(a.label, xm-a.label.length*arcLblSize, ym);
        }
    }

    for(let i=0; i<g.sommets.length; i++){
        let s=g.sommets[i];
        let x1=AX*g.sommets[a.i].x+BX;
        let y1=AY*g.sommets[a.i].y+BY;
        let x=cx*(s[0]-xmin);
        let y=cy*(s[1]-ymin);
        ctx.beginPath();
        ctx.strokeStyle=s[4];
        if(s[4]=='#000000') ctx.lineWidth=lw1;
        else ctx.lineWidth=lw2;
        ctx.fillStyle=arrow?s[4]:'#fff';
        ctx.moveTo(x+2*nodeSize,y);
        ctx.ellipse(x, y, 2*nodeSize, nodeSize, 0, 0, 6.29);
        ctx.fill();
        ctx.stroke();
        if(!arrow){
            ctx.fillStyle=s[4];
            ctx.font=font1;
            ctx.fillText(s[2], x-1.45*r,y,2.9*r);
            ctx.font=font2;
            ctx.fillText(s[3], x-1.5*r,y+r*0.6,3*r);
        }
    }
};

function showTab(t, button=false){
    $(".show").removeClass("selected");
    $("#"+t).addClass("selected");
    $("#tabs button").removeClass("selected");
    if(button) button.addClass("selected");
    else $("#tabs button[data-target='"+t+"']").addClass("selected");
    if(t=='files') initFiles();
    if(t=='show' && button.attr('data-graph')){
        let gname=button.attr('data-graph');
        _graphes[gname].shown=false;
        refreshGraphs();
    }
}

function doZoom(delta){
  if(delta<0){
     _grlg.zoomlv++;
     zoomGraph();
  }else if(delta>0){
     _grlg.zoomlv--;
     zoomGraph();
  }
}

function init(){
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

   editor.getSession().on('change', oneditorChange);
   editor.setOption("showInvisibles", true);

//   editor.setValue(currentFile.code, -1);
//   runCode();

   // Tabs
   $("#tabs button[data-target]").click(function(e){
      let t=$(this).attr("data-target");
      showTab(t, $(this));
   });
   $("#tabs button[data-target='show']").click(function() {
      refreshGraphs();
//      if(_graphes["Gr"]) showGraph(_graphes["Gr"]);
   });

   // Fichiers
   initFiles();

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

let profGroupFilter='all';

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
    if(lf.length>0 && !(lf[0].substring)){
        let lf0=lf.shift();
        let tr=$('<tr></tr>').appendTo(table);
        let td=$('<td colspan=4></td>').appendTo(tr);
        let userSelect=$('<select></select>').appendTo(td);
        $('<option value=0>ME</option>').appendTo(userSelect);
        let groupes={};
        for(let p of lf0){
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
        $('<a href="prof.php">Activité</a>').appendTo(td);
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
                mypost('ajax.php', {action:'mv', who:pwd, src:fn, dest:ns}).then(function(j){
                    initFiles();
                });
            }
            if(e.keyCode===27){
                inputName.hide();
                spanName.show();
            }
        });

        btOpen.click(function(){
            mypost('ajax.php', {action:'load', who:pwd, src:fn}).then(loadCloudFile);
        });

        btDel.click(function(){
            let sur=confirm("Supprimer le fichier "+fn+ " ?");
            if(!sur) return;
            mypost('ajax.php', {action:'rm', who:pwd, fn:fn}).then(function(j){
                if(fn==currentFilename){
                    currentFilename=false;
                    editor.setValue('', -1);
                }
                initFiles()
            });
        });
        btCopy.click(function(){
            mypost('ajax.php', {action:'copy', who:pwd, fn:fn}).then((j)=>initFiles());
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
        mypost('ajax.php', {action:'save', who:pwd, fn:currentFilename, code:editor.getValue()}).then(initFiles);
   });
}


function initFiles(){
   $("#files").empty();
   mypost("ajax.php", {action:'ls', who:pwd}).then(refreshCloud);
   return;
}


function importPyroFile(txt){
    editor.setValue(txt, -1);
}


function splitMove(){
   function changeSplit(svw){
      $("#editor").css("width", ""+svw+"vw");
      $("#splithandle").css("left", ""+svw+"vw");
      $("#ecrandroit").css("left", "calc("+svw+"vw + 6px)");
      $("#ecrandroit").css("width", "calc("+(100-svw)+"vw - 6px)");
   }
   function changeSplitD(svh){
      $("#hautdroit").css("height", ""+(svh-4)+"vh");
      $("#splithandled").css("top", ""+svh+"vh");
      $("#misc").css("top", "calc("+svh+"vh + 4px)");
   }

   var winit=false, hinit=false;;
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
$(splitMove);

function nodeDot(name, s){
    let attr="";
    let col=s.color;
    if (col) attr=`[color=${col} penwidth=4 fontcolor=${col}]`;
    if (s.x!=undefined && s.y!==undefined){
        attr += `[pos="${s.x},${s.y}!"]`
    }
    return ""+name+attr+";";
}

function grayNode(name, s){
    if(s.visible) return '';
    let pos='';
    if (s.x!=undefined && s.y!==undefined){
        pos = ` pos="${s.x},${s.y}!"`
    }
    return `${name}[color=gray  fontcolor=gray${pos}];`
}

function generateDot(g){
    let gr=""; // Chaine contenant le .dot de graphviz
    let orient = g.oriented;
    if(orient) gr+="digraph{";
    else gr+="graph{";
    // Utile uniquement pour les sommets isolés, mais sans effet sur les autres (qui auraient
    // été générés de toutes façons avec leurs arcs)
    // (Note: servira plus tard pour les attributs)
    for(let e in g.sommets){
        // En mode "discover", le sommet n'est affiché que s'il apparait avec l'attribut "visible"
        let s=g.sommets[e];
        if(g.discover && !s.visible) continue;
        gr += nodeDot(e, s);
    }
    // Arcs ou aretes
    for(let a of g.arcs){
        // en mode discover, un arc n'est affiché que si son sommet initial est visible (n'importe quel sommet pour arete)
        if(g.discover && !a.visible) continue; 
        // En mode discover, si un sommet est non visible, mais fait partie de cette arête, on l'affiche en gris
        // (Note, c'est la première déclaration de ce sommet : dans la passe précédente on ne l'a pas affiché. On s'apprêtait à le 
        // définir implicitement en définissant l'arc)
        if(g.discover) {
            gr += grayNode(a.i, g.sommets[a.i]) + grayNode(a.a, g.sommets[a.a]);
        }
        // Construction des attributs (couleur, label)
        let attr="";
        let col=a.color;
        let val=a.val;
        let label=a.label;
        attr=attr+`[tooltip="${a.tooltip}"]`;
        // S'il y a une couleur, on dessine aussi en gras
        if(col!==undefined) attr=attr+`[penwidth=4][color=${col}][fontcolor=${col}]`;
        if(label!==undefined) attr=attr+`[label="${label}"]`;
        else if(val!==undefined) attr=attr+`[label="${""+val}"]`;
        if(orient) gr+=""+a.i +"->"+a.a+attr+";";
        else gr+=""+a.i+"--"+a.a+attr+";";
    }
    gr+="}\n";
    return gr;
}
