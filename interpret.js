// © C. Le Gal, 2017-2018
import grlang from "./grlang.js";
import * as Env from "./environment.js";
import {evaluate, evaluateLVal} from "./expression.js";
import {regularCheck} from "./domcom.js";
import {interpretWithEnv, Line} from "./instructions.js";

// Fonction levant une erreur de syntaxe ou lexicale (call back de l'analyseur syntaxique généré par jison)
grlang.yy.parseError = function(e, h){
   let hh=h;
   hh.msg=e;
   if(hh.token && hh.token=="INVALID"){
      hh.error="lexico";
      hh.name="Erreur lexicale";
      hh.msg="Symbole illégal "+h.text;
   }
   if(hh.line !== undefined){
      hh.ln = hh.line+1;
   }
   throw(hh);
}

// Comme on fait un langage python-like, les tabulations ont un sens syntaxique.
// Mais l'analyseur lexical n'est pas vraiment adapté à cela (la simple présence d'une tabulation
// ne signifie rien hors contexte. Ce qui compte, c'est "y en a-t-il plus, moins ou autant que sur la ligne d'avant")
// Cette fonction, appelée avant l'analyse syntaxique, se charge d'ajouter des symboles §{ et $} quand le nombre
// de tabulations augmente ou baisse dans une ligne
// Ce qui permettra à l'analyseur syntaxique de fonction comme pour un langage normal. En traitant §{ et §} comme
// le begin/end de pascal ou le { } de C/C++/Java/etc
function parseTabulation(str){
   let out=""; // Variable contenant le code transformé
   let startLine=true; // Indique si on vient de commencer une ligne (au début, c'est forcément le cas)
   let indents=[0]; // Nombre d'espace en début de ligne pour le bloc courant
   let ln=1; // Numéro de ligne
   str+="§;\n§;\n"; // Juste pour forcer à finir tous les blocs commencés
   while(str!=""){
      if(startLine){ // Si on vient de commencer une ligne (on vient de commencer le fichier ou de voir un retour charriot)
	 startLine=false;  // on génère potentiellement des §{/§}.   
	 let m=str.match(/[^ ]/).index; // m=nombre d'espaces au début de cette ligne
	 str=str.slice(m);// Maintenant qu'on sait combien il y en a on peut les virer
         if(str[0]=='#' || str[0]=='\r' || str[0]=='\n'){
            // Le premier caractère significatif est un # ou \r ou \n-> on ignore jusqu'au retour charriot
            let numCharBeforeEol = str.indexOf('\n');
            if(numCharBeforeEol<0) str='';
            else{
                str=str.slice(numCharBeforeEol+1);
                startLine=true;
                ln++;
                out += '\n';
            }
            continue;
         }
	 let expected=indents[indents.length-1]; // expected: le nombre d'espace du bloc en cours
	 if(m==expected) continue; // C'est le même, donc rien à faire de spécial. Ni §{ ni §}
	 if(m>expected){ // Il y en a plus. Donc on vient de commencer un bloc indenté. 
	    out+="§{"; // On génère un §{ pour l'analyseur syntaxique
	    indents.push(m); // On note que le bloc courant fait maintenant cette taille d'indentation
	    continue; 
	 }
	 while(m<expected){ // Il y en a moins. Donc on va générer un certain nombre de "end" (pas forcément 1 seul)
	    out += "§}§;";  // ça dépend de combien de niveau au redescend d'un seul coup (est-ce qu'on revient à la taille
	    indents.pop();  // d'indentation précédente ? La précédente de la précédente ? Etc.
	    expected=indents[indents.length-1]; // Note: on ajoute un §;, parce que c'est aussi une fin de ligne
	 }
	 if(m>expected){ // une fois tout ça fait, normalement on est donc sorti des blocs. Mais peut-être que l'indentation
	    throw {error: "indent", msg: false, name: "Erreur d'indentation", ln:ln}; // à la quelle on vient de revenir ne
	 } // correspond à aucune indentation précédente. Genre on est sans indentation → on ouvre un bloc en indentant de 4 espaces
	 // puis on indente de 2 espaces. Ça n'est ni franchement une sortie (on ne revient pas à 0) ni la suite du bloc
	 // (on ne reste pas à 4), ni un nouveau bloc (on ne passe pas à plus que 4). Bref, c'est rien de légal
	 continue;
      }
      else if(str[0]=='\n'){ //Un \n augmente le compteur de numéro de ligne (utilisé uniquement pour les messages d'erreur
	 ln ++; // d'indentation), et signale au présent code que la prochaine lecture correspondra au début d'une ligne
	 out += "\n"; // cad là où on compte les indentations.
	 str=str.slice(1);
	 startLine=true;
	 continue;
      }else{ // Sinon, on se contente de prendre tout ce qui est jusqu'à la fin de la ligne et l'ajouter à la sortie
	 let m=str.match(/^[^\n]+/)[0];
	 out += m;
	 str=str.slice(m.length);
	 continue;
      }
   }
   console.log(out);
   return out;
}




function interpret(tree){
    Env.reset();
    interpretWithEnv(tree, false);
    regularCheck(true);
}

onmessage = function (e){
   try{
      let str=parseTabulation(e.data);
      let out = grlang.parse(str);
      interpret(out);
      postMessage({termine: 0, opcnt:Env.OpCnt});
   }catch(e){
      regularCheck(true);
      if(e.error) {
	 if(e.error=="exit") {
	    if(e.val) postMessage({error:"exec", name:"Erreur signalée par le progamme",
	       msg:"Le programme a déclenché l'erreur "+e.val, ln:e.ln});
	    else postMessage({termine: e.val, tree:out});
	 }
	 else {
            postMessage(e);
        }
      }
      else if(e.msg){
	 postMessage({error: "syntax", name: "Erreur de syntaxe", msg: e.msg, ln: e.line+1, err:e});
      }
      else if(e.message=='too much recursion'){
        postMessage({error:"exec", name:"Limite machine atteinte", msg:"Trop d'appels récursifs", ln:-1});
      }
      else {
         console.trace(e);
         postMessage({error:"interne", name:"Erreur interne", msg:JSON.stringify(e), ln:Line});
         throw(e);
      }
   }
}

