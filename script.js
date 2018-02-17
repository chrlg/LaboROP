var editor;
var worker;
var Range;
var errorMarker=false;
var lastError;

var _grlg = {
   svgw:false,
   svgh:false,
   zoomlv:0,
   zoommin:false
};

function messageFromWorker(event){
   var $m=$("#misc");
   if(errorMarker){
      editor.session.removeMarker(errorMarker);
      errorMarker=false;
   }
   if(event.data.error){
      var e=event.data;
      var ln=e.ln;
      $m.append("<span>Line "+ln+" </span> : ");
      $m.append("<b>"+e.name+"</b><br>");
      if(e.msg) $("#misc").append("<pre>"+e.msg+"</pre>");
      errorMarker = editor.session.addMarker(new Range(ln-1, 0, ln-1, 999), "error", "line");
      lastError = e;
      return;
   }
   if(event.data.print){
      $m.append("<pre class='console'>"+event.data.print+"</pre>");
      return;
   }
   if(event.data.graph){
      showGraph(event.data.graph);
      return;
   }
   if(event.data.termine!==undefined){
      $m.append("<i>Program terminé avec le code "+event.data.termine+" en "+event.data.opcnt+" opérations</i>");
   }

   for(var i=0; i<event.data.length; i++){
      if(event.data[i]=="INVALID") $m.append("<span>###</span> ");
      else $m.append("<b>"+event.data[i]+"</b> ");
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

var timeout=false;
function realEditorChange(){
   if(worker) worker.terminate();
   if(timeout) clearTimeout(timeout);
   worker=false;
   worker = new Worker("interpret.js");
   worker.onmessage = messageFromWorker;
   worker.postMessage(editor.getValue());
   timeout=setTimeout(Terminate, 20000);
   $("#misc").empty();
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
}

function zoomGraph(){
   let targetscale = 1.1**_grlg.zoomlv;
   let targetw = _grlg.svgw*targetscale;
   let targeth = _grlg.svgh*targetscale;
   let winw = $("#svgcont").width();
   let winh = $("#svgcont").height();
   _grlg.zoommin = (targetw<winw && targeth<winh);
   if (targetw<winw) targetw=winw;
   if (targeth<winh) targeth=winh;
   $("#svgcont svg").width(targetw).height(targeth);
}

function showGraph(str){
   window.lastGraph=str;
   try{
      v = Viz(str);
      $("#svgcont").html(v);
      _grlg.svgw = $("#svgcont svg").width();
      _grlg.svgh = $("#svgcont svg").height();
      _grlg.zoommin = false;
      zoomGraph();
      // Pour permettre aisément la sauvegarde (via bouton dans le coin)
      $("#saveimage").attr("href", "data:image/svg;base64,"+btoa(v));
   }catch(e){
      console.log("Viz", str);
      console.log(e);
   }
}

function showTab(t){
   $(".show").removeClass("selected");
   $("#"+t).addClass("selected");
   $("#tabs button").removeClass("selected");
   $("#tabs button[data-target='"+t+"']").addClass("selected");
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

   setInterval(function(){
      if(worker) worker.postMessage("tick");
   }, 1000);

   // Tabs
   $("#tabs button").click(function(e){
      let t=$(this).attr("data-target");
      showTab(t);
   });

   // Fichiers
   initFiles();

   // Zoom dans show
   $("#svgcont").bind("mousewheel DOMMouseScroll", function(e){
      if(!e.altKey) return;
      let ee=e.originalEvent;
      let delta=ee.detail?ee.detail:ee.deltaY;
      if(delta<0){
         _grlg.zoomlv++;
         zoomGraph();
      }else if(delta>0){
         _grlg.zoomlv--;
         zoomGraph();
      }
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
   $("<td colspan=4>").appendTo(tr).append(btNew);
   
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
