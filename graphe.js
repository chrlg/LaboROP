import {FALSE, TRUE, UNDEFINED} from "./constants.js";
import * as Env from "./environment.js";
import {evaluate} from "./expression.js";

// Chaque graphe de Graphes a la structure suivante :
// * name : le nom du graphe. Le graphe par défaut s'appelle Gr
// * sommets : la liste des sommets. Celle de Gr constitue par ailleurs un environnement en soi
// * arcs : la liste des arcs
// * mode : le mode d'affichage. "dot" par défaut, pour Gr. "dot"=rendu avec GraphViz. "map"=rendu des arcs seulement
// * change : true si le graphe a changé depuis la dernière fois qu'il a été affiché
// * oriente : true si le graphe est orienté, false s'il ne l'est pas, undefined si on n'a pas encore décidé
export class Graphe {
    constructor(name){
        this.name = name;  // nom du graphe
        this.sommets = {}; // dictionnaire de ses sommets
        this.arcs = [];    // liste de ses arcs
        this.mode = "dot"; // mode d'affichage. 'dot' utilise graphviz
        this.change = false;        // le graphe a-t-il changé depuis son dernier affichage
        this.oriente = UNDEFINED;   // s'agit-il d'un graphe orienté ou non
        this.discover = false ;     // mode "découverte" ou non : les sommets et arrêtent n'apparaissent pas dans les fonctions 
        this.t = "graphe" ;  // Pour être utilisé comme objet du langage
        // de parcours tant qu'ils n'ont pas été marqués découverts
    }

    // Ce graphe est-il orienté ou non?
    isOrient(){
        return this.oriente.val;
    }
    // setter
    setOrient(o){
        this.oriente.val = o;
    }

    // regénère une description à envoyer au thread d'affichage, si nécessaire (si le graphe a changé,
    // ou si un argument force est passé)
    redraw(force=false){
        if(force || this.change){
            if(this.mode=='dot') this.generateDot();
            else if(this.mode=='map') this.generateMap();
            else if(this.mode=='reseau') this.generateReseau(false);
            else if(this.mode=='arrows' || this.mode=='arrow') this.generateReseau(true);
        }
        this.change=false;
    }

    // Fonction générant du "dot" et l'envoyant au thread HTML pour dessin
    generateDot(){
        let gr=""; // Chaine contenant le .dot de graphviz
        let orient = this.isOrient();
        if(orient) gr+="digraph{";
        else gr+="graph{";
        // Utile uniquement pour les sommets isolés, mais sans effet sur les autres (qui auraient
        // été générés de toutes façons avec leurs arcs)
        // (Note: servira plus tard pour les attributs)
        for(let e in this.sommets){
            // En mode "discover", le sommet n'est affiché que s'il apparait avec l'attribut "visible"
            if(this.discover && !this.sommets[e].marques.visible) continue;
            let attr="";
            let col=this.sommets[e].marques.color;
            if (col && col.t=="string") attr=`[color=${col.val}][penwidth=4][fontcolor=${col.val}]`;
            gr+=(""+e+attr+";");
        }
        // Arcs ou aretes
        for(let a of this.arcs){
            if(this.discover){ // en mode discover, un arc n'est affiché que si son sommet initial est visible (n'importe quel sommet pour arete)
                if(orient && !a.i.marques.visible) continue;
                else if(!orient && !a.i.marques.visible && !a.a.marques.visible) continue;
            }
            // Construction des attributs (couleur, label)
            let attr="";
            let col=a.marques.color;
            let val=a.marques.val;
            let label=a.marques.label;
            let tooltip="("+a.i.name+","+a.a.name+")\n";
            for(let m in a.marques){
                let v=a.marques[m].val;
                tooltip += m + ":"+ ((v!==undefined)?(v.toString()):"{...}") +"\n";
            }
            attr=attr+`[tooltip="${tooltip}"]`;
            // S'il y a une couleur, on dessine aussi en gras
            if(col && col.t=="string") attr=attr+`[penwidth=4][color=${col.val}][fontcolor=${col.val}]`;
            if(label && label.t=="string") attr=attr+`[label="${label.val}"]`;
            else if(val && isNumeric(val)) attr=attr+`[label="${""+val.val}"]`;
            if(orient) gr+=""+a.i.name +"->"+a.a.name+attr+";";
            else gr+=""+a.i.name+"--"+a.a.name+attr+";";
        }
        gr+="}\n";
        // Envoie le graphe au thread principal, qui appelera dot avec
        postMessage({graph:gr, name:this.name});
    }


    // Autre version de l'envoi de graphe, réservé aux cas tellement denses qu'on
    // ne dessine plus les sommets et qu'on ne le fait qu'en fin d'exécution
    // Réservé aux graphes dont tous les nœuds ont un x,y (même si par défaut on remplace par 0)
    generateMap(){
        let gr=[];
        // Calcul des bornes du dessin
        let xmin=Infinity, xmax=-Infinity, ymin=Infinity, ymax=-Infinity;
        for(let i in this.sommets){
            let s=this.sommets[i];
            // Remplacement par 0 s'il n'y a pas de x ou y
            if(s.marques.x===undefined) s.marques.x={t:"number", val:0};
            if(s.marques.y===undefined) s.marques.y={t:"number", val:0};
            let x=s.marques.x.val;
            let y=s.marques.y.val;
            if(x<xmin) xmin=x;
            if(x>xmax) xmax=x;
            if(y<ymin) ymin=y;
            if(y>ymax) ymax=y;
        }
        // Une marge autour du dessin
        let dx=(xmax-xmin);
        xmin-=0.005*dx;
        xmax+=0.005*dx;
        let dy=(ymax-ymin);
        ymin-=0.005*dy;
        ymax+=0.005*dy;

        // Ce qu'on dessine en réalité ce sont uniquement les arcs
        for(let a of this.arcs){
            let s1=a.i;
            let s2=a.a;
            // En mode discover, on ne dessine un arc que si son sommet initial (ou un des sommets pour une arête) est visible
            // Notons que cela n'impacte pas l'échelle du dessin (contrairement au mode dot, dans lequel on "zoome" sur
            // les seuls sommets connus
            if(this.discover){
                let orient=this.isOrient();
                if(orient && !s1.marques.visible) continue;
                else if(!orient && !s1.marques.visible && !s2.marques.visible) continue;
            }
            // Mapping sur une zone [0,4000]×[0,4000]
            let x1=s1.marques.x.val;
            let x2=s2.marques.x.val;
            let y1=s1.marques.y.val;
            let y2=s2.marques.y.val;
            x1=(x1-xmin)*4000.0/(xmax-xmin);
            x2=(x2-xmin)*4000.0/(xmax-xmin);
            y1=(y1-ymin)*4000.0/(ymax-ymin);
            y2=(y2-ymin)*4000.0/(ymax-ymin);
            if(a.marques.color) gr.push([x1,y1,x2,y2,a.marques.color.val]);
            else gr.push([x1,y1,x2,y2]);
        }
        postMessage({mapgr:gr, name:this.name});
    }

    // Affichage en mode "reseau"
    // Cad sommets positionnées en x,y, et n'ayant d'arcs qu'avec des voisins
    // (l'affichage dessine les arcs en ligne droite)
    // Ne pas appeler si les attributs x,y n'existent pas
    generateReseau(arrow=false){
        let grs=[], gra=[]; // grs, tableau de sommets (dans la représentatino réseau), gra, tableau d'arcs
        let xmin=Infinity, xmax=-Infinity, ymin=Infinity, ymax=-Infinity; // bornes
        let assoc={}; // Table associative liant nom du sommet à indice dans grs
        for(let i in this.sommets){
            let s=this.comments[i];
            let x=s.marques.x.val;
            let y=s.marques.y.val;
            if(x<xmin) xmin=x; // update bornes
            if(x>xmax) xmax=x;
            if(y<ymin) ymin=y;
            if(y>ymax) ymax=y;
            // Si un sommet n'est pas visible, il n'entre pas dans la liste des sommets, mais est
            // quand même utilisé pour calculer les bornes
            if(this.discover && !s.marques.visible) continue;
            assoc[s.name]=grs.length; // grs.length est l'index dans grs, puisqu'on n'ajoutera qu'après
            let col='#000000';     // couleur = noir, sauf si une marque "color" existe
            if(s.marques.color) col=s.marques.color.val;
            let lbl='';
            if(s.marques.label) lbl=s.marques.label.val;
            grs.push([x,y,s.name, lbl, col]);
        }
        // Ajustement des bornes pour laisser la place pour dessiner le sommet
        let dx=(xmax-xmin);
        xmin-=0.005*dx;
        xmax+=0.005*dx;
        let dy=(ymax-ymin);
        ymin-=0.005*dy;
        ymax+=0.005*dy;

        for(let a of this.arcs){
            let s1=a.i;
            let s2=a.a;
            // En mode discover on ne dessine que les arcs sont le sommet initial (ou un des sommets pour les aretes)
            // est visible
            if(this.discover){
                let orient=this.isOrient();
                if(orient && !s1.marques.visible) continue;
                else if(!orient && !s1.marques.visible && !s2.marques.visible) continue;
            }

            let col='#000000'; // couleur noir, sauf si l'arc a un attribut color
            if(a.marques.color) col=a.marques.color.val;
            let lbl='';
            if(a.marques.label) lbl=a.marques.label.val;
            gra.push([assoc[s1.name], assoc[s2.name], lbl, col]);
        }
        postMessage({mapres:grs, arcs:gra, name:this.name, bound:[xmin,xmax,ymin,ymax], arrow:arrow});
    }

}

// Fonction interne d'ajout de sommet
export function addSommet(name, graphe, ln){
    if(graphe.name=="Gr" && Env.Graphes[name]) throw{error:"env", name:"Nom de sommet illégal", msg:"Un sommet du graphe Gr ne peut porter le nom d'un graphe", ln:ln};
    graphe.sommets[name] = {t:"Sommet", name:name, marques:{}};
}

export function creerArete(ins){
   let left=ins.left;
   let right=ins.right;

   // Graphe concerné
   let g=Env.getGraph(ins.g, ins.ln);
   // Une arête implique un graphe non orienté. Fixer l'orientation si pas encore fait. Sinon, lever une erreur si contradictoire
   if(g.isOrient()) throw {error:"graphe", name: "Erreur de graphe", msg: "Un graphe orienté ne peut contenir d'arêtes", ln: ins.ln};
   if(g.isOrient()===undefined) g.setOrient(false);

   let l=evalSommet(left, true, g);
   let r=evalSommet(right, true, g);
   if(!l || l.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+left.t+" n'est pas un sommet gauche légal pour une arête", ln:left.ln};
   if(!r || r.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+right.t+" n'est pas un sommet droit légal pour une arête", ln:right.ln};

   let na={t:"Arete", i:l, a:r, marques:{}};
   if(g.arcs.length>10000) throw {error:"memory", name:"Too many arcs", msg:"oom", ln:left.ln};
   g.arcs.push(na);
   g.change=true;
   return na;
}

export function creerArc(ins){
   let left=ins.left;
   let right=ins.right;

   let g=Env.getGraph(ins.g, ins.ln); // Graphe concerné
   // Un arc implique un graphe orienté
   if(g.isOrient()===undefined) g.setOrient(true);
   if(!g.isOrient()) throw {error:"graphe", name:"Erreur de graphe", msg:"Un graphe non orienté ne peut contenir d'arcs", ln:left.ln};

   let l=evalSommet(left, true, g);
   let r=evalSommet(right, true, g);
   if(!l || l.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+left.t+" n'est pas un sommet gauche légal pour un arc", ln:left.ln};
   if(!r || r.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+right.t+" n'est pas un sommet droit légal pour un arc", ln:right.ln};

   let na={t:"Arc", i:l, a:r, marques:{}};
   if(g.arcs.length>10000) throw {error:"memory", name:"Too many arcs", msg:"oom", ln:left.ln};
   g.arcs.push(na);
   g.change=true;
   return na;
}

// Récupère la valeur d'un sommet à partir d'une chaine ou d'une variable non identifiée
// Si creer est true, crée le sommet s'il n'existe pas
// Si le sommet n'existe pas, et n'a pas été créé, retourne le nom à la place
export function evalSommet(som, creer, graphe){
    let str=null;
    let S=null;
    if(som.t=="id"){
        if(graphe.sommets[som.name]!==undefined) return graphe.sommets[som.name]; // Sommet déjà existant (dans ce graphe)
        if(Env.get(som.name)===undefined) str=som.name; // Identifiant non existant. Traité comme une chaîne
    }

    if(str===null){
        let ev=evaluate(som); // Y compris un "id", mais qui peut être une variable de type chaine
        if(ev===undefined) throw {error:"type", name:"Sommet indéfini", msg: "", ln:som.ln};
        if(ev.t=="string") str=ev.val;
        else if(ev.t=="Sommet") str=ev.name; // Note : c'est forcément d'un autre graphe, sinon on ne serait plus là
        else throw {error:"type", name:"Ce n'est pas un sommet", msg:"Une expression de type '"+ev.t+"' n'est pas un sommet légal", ln:som.ln};
    }
    if(str===null) throw {error:"internal", name:"Sommet non défini", msg:"Erreur interne : le sommet est indéfini", ln:som.ln};
    if(!str.match(/^[A-Za-z0-9_]*$/)){
        throw{error: "type", name: "Nom de sommet illégal", 
            msg: "Le nom d'un sommet ne doit contenir que\ndes caractères alphanumériques\nnom:"+str, ln: som.ln};
    }
    if(graphe.sommets[str]) return graphe.sommets[str];
    if(creer) {
        addSommet(str, graphe, som.ln);
        return graphe.sommets[str];
    }
    return str;
}


