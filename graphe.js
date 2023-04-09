// Chaque graphe de Graphes a la structure suivante :
// * name : le nom du graphe. Le graphe par défaut s'appelle G
// * sommets : la liste des sommets. Celle de G constitue par ailleurs un environnement en soi
// * arcs : la liste des arcs
// * mode : le mode d'affichage. "dot" par défaut, pour G. "dot"=rendu avec GraphViz. "map"=rendu des arcs seulement
// * change : true si le graphe a changé depuis la dernière fois qu'il a été affiché
// * oriente : true si le graphe est orienté, false s'il ne l'est pas, undefined si on n'a pas encore décidé
class Graphe {
    constructor(name){
        this.name = name;  // nom du graphe
        this.sommets = {}; // dictionnaire de ses sommets
        this.arcs = [];    // liste de ses arcs
        this.mode = "dot"; // mode d'affichage. 'dot' utilise graphviz
        this.change = false;        // le graphe a-t-il changé depuis son dernier affichage
        this.oriente = UNDEFINED;   // s'agit-il d'un graphe orienté ou non
        this.discover = false ;     // mode "découverte" ou non : les sommets et arrêtent n'apparaissent pas dans les fonctions 
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
            if(this.discover){
                if(orient && !a.i.marques.visible) continue;
                else if(!orient && !a.i.marques.visible && !a.a.marques.visible) continue;
            }
            let attr="";
            let col=a.marques.color;
            let val=a.marques.val;
            let label=a.marques.label;
            let tooltip="("+a.i.name+","+a.a.name+")\n";
            for(let m in this.arcs[i].marques){
                let v=a.marques[m].val;
                tooltip += m + ":"+ ((v!==undefined)?(v.toString()):"{...}") +"\n";
            }
            attr=attr+`[tooltip="${tooltip}"]`;
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
    generateMap(){
        let gr=[];
        let xmin=Infinity, xmax=-Infinity, ymin=Infinity, ymax=-Infinity;
        for(let s of this.sommets){
            if(s.marques.x===undefined) s.marques.x={t:"number", val:0};
            if(s.marques.y===undefined) s.marques.y={t:"number", val:0};
            let x=s.marques.x.val;
            let y=s.marques.y.val;
            if(x<xmin) xmin=x;
            if(x>xmax) xmax=x;
            if(y<ymin) ymin=y;
            if(y>ymax) ymax=y;
        }
        let dx=(xmax-xmin);
        xmin-=0.005*dx;
        xmax+=0.005*dx;
        let dy=(ymax-ymin);
        ymin-=0.005*dy;
        ymax+=0.005*dy;

        for(let a of this.arcs){
            let s1=a.i;
            let s2=a.a;
            if(this.discover){
                let orient=this.isOrient();
                if(orient && !s1.marques.visible) continue;
                else if(!orient && !s1.marques.visible && !s2.marques.visible) continue;
            }
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

}

