// Client-side main worker graph handling (rendering)
let _grlg = {
   svgw:false,
   svgh:false,
   zoomlv:0,
};
let _graphes={"Gr":true};
let _graphRendererRunning=false;


function initSrenderer(){
    let $s = document.getElementById('svgcont');
    $s.addEventListener('click', function(e){
        let g=false;
        for(let k in _graphes){
            let gg=_graphes[k];
            if(gg.shown){
                g=gg;
                break;
            }
        }
        if(!g) return;
        if(e.target.tagName=='text') clickNode(g.name, e.target.textContent);
    });
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
    if(Object.keys(_graphes).length>2) {
        $tabs.classList.add('multextra');
        $extragraph.classList.remove('unrolled');
    }
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

function doZoom(delta){
  if(delta<0){
     _grlg.zoomlv++;
     zoomGraph();
  }else if(delta>0){
     _grlg.zoomlv--;
     zoomGraph();
  }
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

// Generate a graphviz .dot string code for graph g
function generateDot(g){
    let gr=""; // Chaine contenant le .dot de graphviz
    let orient = g.oriented;
    if(orient) gr+="digraph{";
    else gr+="graph{";
    gr += 'bgcolor="transparent"\n';
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

// generate a gray node dot code (utility called by previous)
function grayNode(name, s){
    if(s.visible) return '';
    let pos='';
    if (s.x!=undefined && s.y!==undefined){
        pos = ` pos="${s.x},${s.y}!"`
    }
    return `${name}[color=gray  fontcolor=gray${pos}];`
}

// generate a colored node dot code 
function nodeDot(name, s){
    let attr="";
    let col=s.color;
    if (col) attr=`[color=${col} penwidth=4 fontcolor=${col}]`;
    if (s.x!=undefined && s.y!==undefined){
        attr += `[pos="${s.x},${s.y}!"]`
    }
    return ""+name+attr+";";
}

