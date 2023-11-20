import * as Env from "./environment.js";

let modules = {};

export function isLoaded(name){
    return modules[name];
}

export function markLoaded(name){
    modules[name]=true;
}

let _r=0;


export function load(name, ln){
    // Synchronous ajax load of json
    let url='Modules/mod_'+name+".json";
    let req=new XMLHttpRequest();
    req.responseType = 'json';
    req.open('GET', url, false);
    req.send(null);

    if(req.status!=200) throw {error:"module", name:"Module introuvable", msg:`Module ${name} inexistant`, ln:ln};
    if(!req.response) throw {error:"module", name:"Erreur dans le module", msg:`Impossible de charger module ${name}`, ln:ln};
    let j=req.response;

    // Modules is imported on graph Gr, unless said otherwise in the module itself (that may specify a graph name)
    let g=Env.Gr;
    if(j.name) {
        if(!Env.Graphes[j.name]) Env.addGraphe(j.name, ln);
        g=Env.Graphes[j.name];
    }
    // Import implies resetting graph.
    g.reset();
    if(j.mode) g.mode=j.mode; // Mode if one is specified (otherwise default of graphe.js is "dot")
    if(j.discover) g.discover=j.discover; // Whether this is in "discover" mode (nodes are visible only when marked as such). Default is false
    // By default graph are undirected. But attribute "oriented" can be set true in json
    if(j.oriented) g.setOrient(j.oriented);
    else g.setOrient(false);

    // json can contain a field "names" for the nodes names. And a field pos, for their position.
    // If both are specified, then, they must be of the same size
    if(j.names && j.pos && j.names.length!=j.pos.length){
        throw {error:"interne", name:"Erreur dans le module", msg:`Nombre de noms et de position des sommets incohérents dans ${name}`, ln:ln};
    }
    let ns=0;
    if(j.names) ns=j.names.length;
    else if(j.pos) ns=j.pos.length;

    // If no names nor pos have been specified, but a order has been given, then generate nodes 
    if(ns==0 && j.order){
        j.names==[];
        j.pos=false;
        ns=j.order;
        for(let i=1; i<=ns; i++) j.names.push("S"+i);
    }

    // Create nodes. Keep an indexed list of those, to be able to create edges
    let soms=[];
    for(let i=0; i<ns; i++){
        let s=g.addNode(j.names?j.names[i]:"S"+(i+1), ln);
        soms.push(s);
        if(j.pos){
            s.marques['x']={t:"number", val:j.pos[i][0]};
            s.marques['y']={t:"number", val:j.pos[i][1]};
        }
    }
    // Some json call the edge list "edge", some othe "edges". Let's accept both
    if(j.edge && j.edegs===undefined) j.edges=j.edge;

    // If json contain "valName" attribute, then use it to store values
    // Note: il valName is explicitly set to false, then, no value is added to edges, even if a value is specified in json
    // if j.dist is true, then, in absence of a value, the euclidean distance is used, when possible (when nodes have a position)
    let valName="val";
    if(j.valName!==undefined) valName=j.valName;
    if(j.valNames) valName=j.valNames[0]; // We can also specify more than one name, in case we have more than one value

    for(let p of j.edges){
        let d=undefined;
        let s1=soms[p[0]];
        let s2=soms[p[1]];
        if(p.length>=3) d=p[2];
        else if (j.pos && j.dist){
            let x1=s1.marques.x;
            let x2=s2.marques.x;
            let y1=s1.marques.y;
            let y2=s2.marques.y;
            d=Math.sqrt((x1-x2)**2 + (y1-y2)**2);
        }
        let m={};
        if(d!==undefined && valName) m[valName] = {t:'number', val:d};
        // For other attributes, if more than one is specified via j.valNames, it is simpler: just take them from the array (there must be one)
        if(j.valNames){
            for(let k=1; k<j.valNames.length; k++){
                m[j.valNames[k]] = {t:'number', val:p[k+2]};
            }
        }
        if(j.oriented) g.addArc(s1, s2, m);
        else g.addArete(s1, s2, m);
    }
}

function loadCb(json){
    console.log(json);
}


function importGraphe(g,v){
   for(let i=0; i<g[0].length; i++){
      let x={t:"number", val:g[0][i][0]};
      let y={t:"number", val:g[0][i][1]};
      _grapheEnv["S"+i] = {t:"Sommet", name:"S"+i, marques:{x:x, y:y}};
   }
   for(let p of g[1]){
      let s1=_grapheEnv["S"+p[0]];
      let s2=_grapheEnv["S"+p[1]];
      let d={t:"number", val:0};
      if(p.length==3) d.val=p[2];
      else{
         let x1=s1.marques.x;
         let x2=s2.marques.x;
         let y1=s1.marques.x;
         let y2=s2.marques.x;
         d.val=Math.sqrt((x1-x2)**2 + (y1-y2)**2);
      }
      if (v=="noValues") _arcs.push({t:"Arete", i:s1, a:s2, marques:{}});
      else _arcs.push({t:"Arete", i:s1, a:s2, marques:{val:d}});
   }
   _grapheChange=true;
   _grapheMode="map";
}

