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

var _graphes={};
var _grapheMode="dot";

var timeout=false;
function messageFromWorker(event){
   if(event.data.error){
      let e=event.data;
      let ln=e.ln;
      let $e=$("#errors");
      $e.append("<span>Line "+ln+" </span> : ");
      $e.append("<b>"+e.name+"</b><br>");
      if(e.msg) $e.append("<pre>"+e.msg+"</pre>");
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
      $("#svgcont").show();
      $("#canvascont").hide();
      updateGraph(event.data);
      return;
   }
    if(event.data.mapgr){
        $("#svgcont").hide();
        $("#canvascont").show();
        showMap(event.data.mapgr);
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
   if(e.lines.length<2) return;
   if(e.action!="insert") return;
   let str=editor.session.getLine(e.start.row);
   if(str[0]==" ") return;
   if(str.indexOf(":")>=0) return;
   realEditorChange();
}

function realEditorChange(){
   if(worker) worker.terminate();
   if(timeout) clearTimeout(timeout);
   worker=false;
   worker = new Worker("interpret.js", {type:"module"});
   worker.onmessage = messageFromWorker;
   worker.onerror = (e) => {console.log(e);};
   worker.postMessage(editor.getValue());
   timeout=setTimeout(Terminate, timeoutLen);
   $("#console").empty();
   $("#status").empty();
   $("#errors").empty();
   $("#svgcont").empty();
   $("#extragraph").empty();
   _graphes={};
   if(errorMarker){
      editor.session.removeMarker(errorMarker);
      errorMarker=false;
   }
}

function saveCode(e, f, g){
   currentFile.code = editor.getValue();
   saveFiles();
   realEditorChange();
   return true;
}

function runCode(){
   realEditorChange();
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
   if(_lastMapLines) showMap(_lastMapLines);
   else if(_lastResData) showReseau(_lastResData[0], _lastResData[1], _lastResData[2], _lastResData[3], _lastResData[4]);
}

function updateGraph(gr){
   _grapheMode="dot";
   let str=gr.graph;
   let name=gr.name;
   _graphes[name]=Viz(str);
   if(name=="G") showGraph("G");
   else createExtraGraph(name);
}

function createExtraGraph(name){
   let $but=$("<button>"+name+"</button>");
   $("#extragraph").append($but);
   $but.click(function(){
      showTab("show", $but);
      showGraph(name);
   });
}

let _lastMapLines=false;
let _lastResData=false;
function showGraph(name){
    _lastMapLines=false;
    _lastResData=false;
    $("#svgcont").html(_graphes[name]);
    _grlg.svgw = $("#svgcont svg").width();
    _grlg.svgh = $("#svgcont svg").height();
    zoomGraph();
    // Pour permettre aisément la sauvegarde (via bouton dans le coin)
    //$("#saveimage").attr("href", "data:image/svg;base64,"+btoa(v));
}

function showMap(lines){
    _lastMapLines=lines;
    _lastResData=false;
    let targetscale = 1.1**_grlg.zoomlv;
    _grapheMode="map";
    let cv=$("#canvascont canvas")[0];
    let ctx=cv.getContext("2d");
    ctx.clearRect(0, 0, 4000, 4000);
    ctx.strokeStyle="#000";
    ctx.lineWidth=4.0/targetscale;
    for(let i=0; i<lines.length; i++){
        let L=lines[i];
        if(L.length>4) continue;
        ctx.beginPath();
        ctx.strokeStyle="#000";
        ctx.moveTo(L[0], L[1]);
        ctx.lineTo(L[2], L[3]);
        ctx.stroke();
    }
    ctx.lineWidth=12.0;//targetscale;
    for(let i=0; i<lines.length; i++){
        let L=lines[i];
        if(L.length<5) continue;
        ctx.beginPath();
        ctx.strokeStyle=L[4];
        ctx.moveTo(L[0], L[1]);
        ctx.lineTo(L[2], L[3]);
        ctx.stroke();
    }
}

function showReseau(sommets, arcs, name, bound, arrow){
    _lastMapLines=false;
    _lastResData=[sommets, arcs, name, bound, arrow];
    let targetscale = 1.1**_grlg.zoomlv;
    let cv=$("#canvascont canvas")[0];
    let ctx=cv.getContext("2d");
    ctx.clearRect(0, 0, 4000, 4000);
    ctx.strokeStyle="#000";
    let lw1=4.0/targetscale;
    let lw2=12.0/targetscale;
    let xmin=bound[0]-1;
    let xmax=bound[1]+1;
    let ymin=bound[2]-1;
    let ymax=bound[3]+1;
    let cx=4000.0/(xmax-xmin);
    let cy=4000.0/(ymax-ymin);
    let r=80/targetscale;
    let font1=''+(r*1.1)+'px sans';
    let font2=''+(r*0.7)+'px sans';
    let arcLblSize=r*0.25;
    let nodeSize=arrow?(r/10):r;
    for(let i=0; i<arcs.length; i++){
        let a=arcs[i];
        let s1=sommets[a[0]];
        let s2=sommets[a[1]];
        ctx.beginPath();
        ctx.strokeStyle=a[3];
        if(a[3]=='#000000') ctx.lineWidth=lw1;
        else ctx.lineWidth=lw2;
        let x1=cx*(s1[0]-xmin);
        let x2=cx*(s2[0]-xmin);
        let y1=cy*(s1[1]-ymin);
        let y2=cy*(s2[1]-ymin);
        let xm=(x1+x2)/2;
        let ym=(y1+y2)/2;
        ctx.moveTo(x1,y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
        ctx.fillStyle=a[3];
        if(arrow){
            // cos(30) -sin(30)  |  x1-x2
            // sin(30) cos(30)   |  y1-y2
            let fc=0.7*r/Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
            ctx.moveTo(x2,y2);
            ctx.lineTo(fc*(0.94*(x1-x2)-0.342*(y1-y2))+x2, fc*(0.94*(y1-y2)+0.342*(x1-x2))+y2);
            ctx.lineTo(fc*(0.94*(x1-x2)+0.342*(y1-y2))+x2, fc*(0.94*(y1-y2)-0.342*(x1-x2))+y2);
            ctx.fill();
        }
        ctx.font=font2;
        ctx.fillText(a[2], xm-a[2].length*arcLblSize, ym);
    }
    for(let i=0; i<sommets.length; i++){
        let s=sommets[i];
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
   editor.commands.addCommand({name:"ShowMatrix", bindKey:{win:"alt-m",mac:"Alt-m"},
         exec:()=>{showTab("matrix");}});
   editor.commands.addCommand({name:"ShowFiles", bindKey:{win:"alt-f",mac:"Alt-f"},
         exec:()=>{showTab("files");}});
   editor.commands.addCommand({name:"Stop", bindKey:{win:"alt-c",mac:"Alt-c"},
         exec:()=>{Terminate();}});
   editor.commands.addCommand({name:"Save&Run", 
         bindKey:{win:"Ctrl-s", mac:"Command-s"}, exec:saveCode});
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
   editor.setValue(currentFile.code, -1);
   realEditorChange();

   // Tabs
   $("#tabs button[data-target]").click(function(e){
      let t=$(this).attr("data-target");
      showTab(t, $(this));
   });
   $("#tabs button[data-target='show']").click(function() {
      if(_graphes["G"]) showGraph("G");
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
}

$(init);

function initFiles(){
   $("#files").empty();
   let table=$("<table></table>").appendTo($("#files"));
   for(let i=0; i<listFiles.length; i++){
      let tr=$("<tr></tr>").appendTo(table);
      let spanName=$("<span>"+listFiles[i].name+"</span>");
      if(listFiles[i].name==currentFilename) spanName.css("color", "red");
      let inputName=$("<input />").val(listFiles[i].name).hide();
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
            for(let i=0; i<listFiles.length; i++){
               if(listFiles[i].name==inputName.val()){
                  alert("Ce fichier existe déjà");
                  return;
               }
            }
            currentFile.name=inputName.val();
            currentFilename=currentFile.name;
            saveFiles();
            initFiles();
         }
      });

      btOpen.click(function(){
         currentFilename=listFiles[i].name;
         currentFile=listFiles[i];
         editor.setValue(currentFile.code, -1);
         saveFiles();
         initFiles();
      });

      btDel.click(function(){
         if(listFiles[i]===currentFile){
            alert("Fichier en cours d'édition");
            return;
         }
         var sur=confirm("Supprimer le fichier "+listFiles[i].name+ " ?");
         if(!sur) return;
         listFiles.splice(i, 1);
         saveFiles();
         initFiles();
      });

      btCopy.click(function(){
         let orgname=listFiles[i].name;
         let newname="";
         for(let cnt=1; ; cnt++){
            let exist=false;
            newname=orgname+" ("+cnt+")";
            for(let j=0; j<listFiles.length; j++){
               if(listFiles[j].name==newname) exist=true;
            }
            if(exist) continue;
            break;
         }
         newfile={name:newname, code: listFiles[i].code};
         listFiles.push(newfile);
         saveFiles();
         initFiles();
      });
   }

   let tr=$("<tr>").appendTo(table);
   let inputNew=$("<input />");
   $("<td>").appendTo(tr).append(inputNew);
   let btNew=$("<button>Créer nouveau</button>")
   $("<td colspan=2>").appendTo(tr).append(btNew);
   let btImport=$("<input type='file' onchange='this.files[0].text().then(t => importPyroFile(t))'>");
   $("<td colspan=2>").appendTo(tr).append(btImport);
   
   btNew.click(function(){
      if(inputNew.val()==""){
         alert("Saisissez un nom d'abord");
         return;
      }
      for(let i=0; i<listFiles.length; i++){
         if(listFiles[i].name==inputNew.val()){
            alert("Fichier déjà existant");
            return;
         }
      }
      currentFile={name:inputNew.val(), code:""};
      editor.setValue("", -1);
      listFiles.push(currentFile);
      currentFilename=inputNew.val();
      saveFiles();
      initFiles();
   });
}

export function importPyroFile(txt){
    editor.setValue(txt, -1);
}
window.importPyroFile=importPyroFile;


var listFiles, currentFilename, currentFile;
function saveFiles(){
   localStorage.setItem("laborop_files", JSON.stringify(listFiles));
   localStorage.setItem("laborop_currentFilename", currentFilename);
}
function initStorage(){
   listFiles = localStorage.getItem("laborop_files");

   // Liste de mes fichiers
   if(!listFiles){ // Si je n'en ai pas encore, je crée une liste vide
      listFiles=[];
      saveFiles();
   }
   else{
      listFiles=JSON.parse(listFiles);
   }

   // Si un code "unique" laborop_code existe, je le converti en un fichier "premierLabo"
   let fromls=localStorage.getItem("laborop_code");
   if(fromls){
      listFiles.push({name:"Premier Labo", code:fromls});
      saveFiles();
      localStorage.removeItem("laborop_code");
   }

   // Fichier en cour d'édition
   var NOW = new Date();
   var NOWSTR = ""+(NOW.getYear()+1900)+"-"+(NOW.getMonth()+1)+"-"+(NOW.getDate())+"/"+(NOW.getHours())+":"+(NOW.getMinutes());
   currentFilename = localStorage.getItem("laborop_currentFilename");
   if(!currentFilename){
      if(listFiles.length>0){ // S'il n'y a pas de fichier en cours, mais qu'il y a des fichiers, on prend le 1er
         currentFilename = listFiles[0].name;
      }else{ // Sinon, on l'appelle "nouveau"
         currentFilename="Nouveau "+NOWSTR;
         listFiles.push({name:currentFilename, code:""});
      }
      saveFiles();
   }

   currentFile=false;
   for(let i=0; i<listFiles.length; i++){
      if(listFiles[i].name==currentFilename){
         currentFile=listFiles[i];
         break;
      }
   }

   if(currentFile===false){ // Peut arriver s'il y avait un currentFilename, mais dont le fichier a été effacé
      currentFilename="Nouveau "+NOWSTR;
      currentFile={name:currentFilename, code:""};
      listFiles.push(currentFile);
      saveFiles();
   }

   // Solution Labo2
   for(let sol of _sols){
      let thissol=false;
      for(let i=0; i<listFiles.length; i++){
         if(listFiles[i].name==sol.name) thissol=listFiles[i];
      }
      if(!thissol) {
         thissol={name:sol.name, version:0};
         listFiles.push(thissol);
      }

      if(thissol.version < sol.version){
         thissol.version=sol.version;
         thissol.code = sol.code;
      }
   }
   saveFiles();
}

initStorage();


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
