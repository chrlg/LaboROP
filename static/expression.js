// © C. Le Gal 2017-2023. 
// expression : evaluation des expressions du langage

import * as Env from "./environment.js";
import * as Mat from "./matrix.js";
import {FALSE, TRUE, NONE} from "./constants.js";
import {evalSommet, evalGraphe, creerArc, creerArete} from "./graphe.js";
import {interpCall, setRef} from "./instructions.js";
import Decimal from "./lib/decimal.mjs";

Decimal.set({precision:50});

const binaryOp = ["+", "-", "*", "/", "//", "%", "**", ".+", ".*", ".^"];

// Retourne vrai ssi v est numérique, cad un nombre ou un décimal
export function isNumeric(v){
   if(v.t=='number') return true;
   if(v.t=='decimal') return true;
   return false;
}

// Retourne la valeur numérique (nombre javascript, donc avec potentielle erreur numérique) d'une expression numérique
// undefined si ce n'est pas une expression numérique
export function numericValue(v){
    if(v.t=='number') return v.val;
    if(v.t=='decimal') return v.val.toNumber();
    return undefined;
}

// Get field of name fieldName from struct o. Used by both field (o.field) and index (o['field'])
function getField(o, fieldName, ln){
    let res=NONE;
    if(o.t=="struct") res=o.f[fieldName];
    else if(o.t=="Arc" || o.t=="Arete"){
        if(fieldName=="initial") res=o.i;
        else if(fieldName=="terminal") res=o.a;
        else res=o.marques[fieldName];
    }
    else if(o.t=="Sommet") res=o.marques[fieldName];
    else if(o.t=="graphe") res=o.sommets[fieldName];
    else if(o.t=='array' && fieldName=='length') res={t:"number", val:o.val.length};
    else if(o.t=='matrix' && fieldName=='length') res={t:"number", val:o.val.length};
    else if(o.t=='string' && fieldName=='length') res={t:"number", val:o.val.length};
    else throw {error:"type", name:"Pas une structure", msg:"Un objet de type "+o.t+" n'a pas de champs", ln:ln};
    if(res===undefined) return NONE;
    else return res;
}

// Main function : evaluate an expression
// Note: expressions may be decorated with an attribute `.l` which is a lambda function returning their values
// That avoids, if expression is evaluated more than once, to redecide each time the appropriate computation way
// Note 2: local symbols are assumed to be affected before their first usage. No static checking of that is performed.
// If that is not so, this is UB: return value could `undefined`. Or it could turn out to be wrongly associated
// with a global value of the same name, even after that value is affectated as a local value
// ex x=15; def f(): print(x); x=12; print(x)
// prints 15 twice, because x, first time, is global x, and, second time, because of expr.l associated it with global x, continue to be 15
// even after creation of a local x whose value is 12 (and which cannot be accesible as r-value)
// In real python, such a code would raise a "local symbol used before affectation" error.
// Here, it is just UB. In both languages, this shouldn't be done.
export function evaluate(expr){
    // JIT
    if(expr.l!==undefined) return expr.l();

    // Native values
    // They are transmitted by jison parser in the form they also have in this interpreter. So just return parsed constant
    if(expr.t=="string" || expr.t=="number" || expr.t=="boolean"){
        expr.l=function(){return expr;};
        return expr;
    }
    // Decimals are transmitted by jison in the form of a DECIMAL (all caps) type, with a string as value
    // We need to create the constant Decimal type here
    if(expr.t=="DECIMAL"){
        let d={t:"decimal", val:Decimal(expr.s)};
        expr.l=function(){return d;};
        return d;
    }

    // Accès à une variable. Pour être une expression, il ne peut s'agir d'une fonction
    // (le langage interdit donc les pointeurs de fonctions)
    if(expr.t=="id"){
        let name=expr.name;
        let e=Env.getEnv(name);
        if(e===undefined) throw {error:"variable", name:"Symbole non défini", msg: "Symbole "+name+" non défini", ln:expr.ln};
        if(e[name].t=='predvar'){
            expr.l=e[name].f;
            return expr.l();
        // The 3 next case may seem strange (why not just return e[name]?)
        // But those environment may change (at least Local/Current may. Global is just defensive)
        // Calling getEnv again would be unnecessary: code structure won't change. So, if symbol is local, it is local forever
        // Yet, Local env may not be, when expr.l will be called the same as e
        }else if(e===Env.Global){
            expr.l=function(){return Env.Global[name];};
        }else if(e===Env.Local){
            expr.l=function(){return Env.Local[name];};
        }else if(e===Env.Current){
            expr.l=function(){return Env.Current[name];};
        }
        else expr.l=function(){return Env.get(name);}
        return e[name];
    }

    // == ou !=
    if(expr.t=="==" || expr.t=="!=") return evaluateEqual(expr);

    // and / or
    if(expr.t=="and"){
        expr.l=function(){
            let a=evaluate(expr.left);
            if(a.t=='None') a=FALSE;
            if(a.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.left.ln};
            if(!a.val) return FALSE;
            let b=evaluate(expr.right);
            if(b.t=='None') b=FALSE;
            if(b.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.ln};
            if(b.val) return TRUE;
            else return FALSE;
        }
        return expr.l();
    }
    if(expr.t=="or"){
        expr.l=function(){
            let a=evaluate(expr.left);
            if(a.t=='None') a=FALSE;
            if(a.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.left.ln};
            if(a.val) return TRUE;
            let b=evaluate(expr.right);
            if(b.t=='None') b=FALSE;
            if(b.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.ln};
            if(b.val) return TRUE;
            else return FALSE;
        }
        return expr.l();
    }
    if(expr.t=="&&"){
        expr.l=function(){
            let a=evaluate(expr.left);
            let b=evaluate(expr.right);
            if(a.t=='None') a=FALSE;
            if(a.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.left.ln};
            if(!a.val) return FALSE;
            if(b.t=='None') b=FALSE;
            if(b.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.ln};
            if(b.val) return TRUE;
            else return FALSE;
        }
        return expr.l();
    }
    if(expr.t=="||"){
        expr.l=function(){
            let a=evaluate(expr.left);
            let b=evaluate(expr.right);
            if(a.t=='None') a=FALSE;
            if(a.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.left.ln};
            if(a.val) return TRUE;
            if(b.t=='None') b=FALSE;
            if(b.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.ln};
            if(b.val) return TRUE;
            else return FALSE;
        }
        return expr.l();
    }

    // xor
    if(expr.t=="xor"){
        expr.l=function(){
            let a=evaluate(expr.left);
            let b=evaluate(expr.right);
            if(a.t=='None') a=FALSE;
            if(b.t=='None') b=FALSE;
            if(a.t!="boolean" || b.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.ln};
            if(a.val && !b.val) return TRUE;
            if(!a.val && b.val) return TRUE;
            return FALSE;
        }
        return expr.l();
    }


    // Comparaison (inégalité)
    // Uniquement pour des valeurs scalaires
    if(expr.t=="<" || expr.t==">" || expr.t=="<=" || expr.t==">="){
        let comp=false;
        let compd=false;
        if(expr.t=="<") {
            comp=function(a,b){ return (a<b)?TRUE:FALSE;};
            compd=function(a,b){ return a.lt(b)?TRUE:FALSE;};
        }
        else if(expr.t==">") {
            comp=function(a,b){ return (a>b)?TRUE:FALSE;};
            compd=function(a,b){ return a.gt(b)?TRUE:FALSE;};
        }
        else if(expr.t=="<=") {
            comp=function(a,b){ return (a<=b)?TRUE:FALSE;};
            compd=function(a,b){ return a.lte(b)?TRUE:FALSE;};
        }
        else if(expr.t==">=") {
            comp=function(a,b){ return (a>=b)?TRUE:FALSE;};
            compd=function(a,b){ return a.gte(b)?TRUE:FALSE;};
        }

        expr.l=function(){
            let a=evaluate(expr.left);
            let b=evaluate(expr.right);
            Env.addCnt(1);
            if(isNumeric(a) && isNumeric(b)){
                if(a.t=="number" && b.t=="number") return comp(a.val, b.val);
                if(a.t=="decimal") return compd(a.val, b.val);
                return compd(Decimal(a.val), b);
            }
            if(a.t != b.t) throw {error:"type", name:"Comparaison de valeur de types différents",
                msg:`tentative de comparer un ${a.t} et un ${b.t}`, ln:expr.ln};
            let vala=false, valb=false;
            if(a.t=="number" || a.t=="string"){
                vala=a.val;
                valb=b.val;
            }else if(a.t=="Sommet"){
                vala=a.name;
                valb=b.name;
            }else throw {error:"type", name:"Type invalide pour une comparaison",
                msg:"Tentative de comparer deux valeurs de type "+a.t, ln:expr.ln};
            return comp(vala,valb);
        }
        return expr.l();
    }

    // Arete ou arc
    if(expr.t=="arete" || expr.t=="arc" || expr.t=="lvarc" || expr.t=="lvarete"){
        let v=evaluateArc(expr);
        if(v===undefined) throw {error:"type", name:"Arc ou arête inexistant", msg:"", ln:expr.ln};
        if(v.t=="None") return v;
        if(v.t=="Arc" || v.t=="Arete") return v;
        throw {error:"type", name:"Pas un arc ou arête", msg:"", ln:expr.ln};
    }

    // ++ / --
    if(expr.t=="++" || expr.t=="--"){
        let op;
        if(expr.left) op=evaluateLVal(expr.left);
        else if(expr.right) op=evaluateLVal(expr.right);
        else throw {error:"interne", name:"++ ou -- sans opérande", msg:"", ln:expr.ln};
        if(op.length!=2) throw {error:"type", name:"++ ou -- utilisé sur arc ou arête", msg:"", ln:expr.ln};
        let v=getRef(op);
        if(!v) throw {error:"env", name:"Variable non définie", msg:"", ln:expr.ln};
        if(!isNumeric(v)) throw {error:"type", name:"Erreur de type", 
            msg:"++ ou -- attend un nombre et a été utilisé sur un "+v.t, ln:expr.ln};
        let newVal;
        if(v.t=='number'){
            newVal={t:"number", val:v.val};
            if(expr.t=="++") newVal.val++;
            else newVal.val--;
        }else{
            newVal={t:"decimal", val:v.val};
            if(expr.t=="++") newVal.val = newVal.val.plus(1);
            else newVal.val = newVal.val.minus(1);
        }

        setRef(op, newVal, expr.ln);
        Env.addCnt(1);

        if(expr.left) return v;
        else return newVal;
    }

    if(binaryOp.indexOf(expr.t)>=0){
        let a=evaluate(expr.left);
        let b=evaluate(expr.right);

        // Cas particulier pour le + : on accepte aussi chaines et tableau, et booléens
        if(expr.t=="+"){
            if(a.t=="array"){
                if(b.t=="array"){ // Concaténation
                    return {t:"array", val:a.val.concat(b.val)};
                }else{
                    let val=a.val.slice(); // Copie
                    val.push(b);
                    return {t:"array", val:val};
                }
            }
            if(a.t=="matrix"){
                // M + x = addition de x à tous les coefs de M
                if(isNumeric(b)) return Mat.plusScalar(a, numericValue(b));
                if(b.t=="matrix") {
                    let r=Mat.sum(a,b);
                    if(!r) throw {error:"exec", name:"Erreur de dimension", 
                                  msg:`tentative d'additionner des matrices de dimensions ${a.val.length}≠${b.val.length}`, ln:expr.ln};
                    return r;
                }
            }
            if(a.t=="string"){
                if(b.t=="string") return {t:"string", val:a.val+b.val};
                if(isNumeric(b)) return {t:"string", val:a.val+b.val};
                if(b.t=="boolean") return {t:"string", val:a.val+(b.val?"True":"False")};
                if(b.t=="Sommet") return {t:"string", val:a.val+b.name};
                if(b.t=="Arc") return {t:"string", val:a.val+"("+b.i.name+","+b.a.name+")"};
                if(b.t=="Arete") return {t:"string", val:a.val+"["+b.i.name+","+b.a.name+"]"};
                if(b.t=="None") return {t:"string", val:a.val+"None"};
                throw {error:"type", name:"Erreur de type", msg:"", ln:expr.ln};
            }
            if(a.t=="boolean"){ // Ou non paresseux
                if(b.t=="boolean") return (a.val||b.val)?TRUE:FALSE;
                throw {error:"type", name:"Erreur de type", msg:"", ln:expr.ln};
            }
        }

        // Specific cases for "-"
        if(expr.t=="-"){
            if(a.t=="matrix" && isNumeric(b)) return Mat.plusScalar(a, -numericValue(b));
            if(a.t=="matrix" && b.t=="matrix") {
                let r=Mat.minus(a,b);
                if(!r) throw {error:"exec", name:"Erreur de dimension", 
                              msg:`tentative de soustraire des matrices de dimensions ${a.val.length}≠${b.val.length}`, ln:expr.ln};
                return r;
            }
            if(isNumeric(a) && b.t=="matrix") return Mat.scalarMinus(numericValue(a), b);
        }

        // Cas particulier pour *
        if(expr.t=="*"){
            // Non-lazy AND 
            if(a.t=="boolean" && b.t=="boolean") {
                Env.addCnt(1);
                return (a.val&&b.val)?TRUE:FALSE;
            }

            // Multiplication matricielle
            if(a.t=="matrix" && b.t=="matrix") {
                let r=Mat.mul(a,b);
                if(!r) throw {error:"exec", name:"Erreur de dimension", 
                              msg:`tentative de multiplier des matrices de dimensions ${a.val.length}≠${b.val.length}`, ln:expr.ln};
                return r;
            }

            // Matrix times number
            if(a.t=="matrix" && isNumeric(b)) return Mat.mulScalar(a,numericValue(b));
            if(b.t=="matrix" && isNumeric(a)) return Mat.mulScalar(b,numericValue(a));
        }

        // Cas particulier pour **
        if(expr.t=="**"){
            if(a.t=="matrix" && isNumeric(b)) return Mat.pow(a, numericValue(b));
        }

        if(expr.t==".^"){
            if(a.t=="matrix" && isNumeric(b)) return Mat.boolPow(a, numericValue(b));
            if(a.t=="number" && b.t=="number") return {t:"number", val:(a.val!=0)?1:0};
            else if(isNumeric(a) && isNumeric(b)) return {t:"decimal", val:numericValue(a)!=0?Decimal(1):Decimal(0)};
        }

        // ".+" n'a de sens que sur les matrices (et, cadeau, 2 nombres)
        if(expr.t==".+"){
            if(isNumeric(a) && isNumeric(b)){
                Env.addCnt(1);
                return {t:"number", val:(numericValue(a)!=0 || numericValue(b)!=0)?1:0};
            }
            if(a.t!="matrix" || b.t!="matrix")
                throw {error:"type", name:"Erreur de type", 
                    msg:"Types "+a.t+","+b.t+" incompatibles pour .+", ln:expr.ln};
            let r=Mat.dotsum(a,b);
            if(!r) throw {error:"exec", name:"Erreur de dimension", 
                          msg:`tentative d'additionner des matrices de dimensions ${a.val.length}≠${b.val.length}`, ln:expr.ln};
            return r;
        }

        // ".*" sur matrices et nombres
        if(expr.t==".*"){
            if(isNumeric(a) && isNumeric(b)){
                Env.addCnt(1);
                return {t:"number", val:(numericValue(a)!=0 && numericValue(b)!=0)?1:0};
            }
            if(a.t!="matrix" || b.t!="matrix")
                throw {error:"type", name:"Erreur de type", 
                    msg:"Types "+a.t+","+b.t+" incompatibles pour .*", ln:expr.ln};
            let r=Mat.boolMul(a,b);
            if(!r) throw {error:"exec", name:"Erreur de dimension", 
                          msg:`tentative de multiplier des matrices de dimensions ${a.val.length}≠${b.val.length}`, ln:expr.ln};
            return r;
        }

        if(!isNumeric(a) || !isNumeric(b)) throw {error:"type", name:"Erreur de type", msg:"Types "+a.t+expr.t+b.t+" incompatibles", ln:expr.ln};
        Env.addCnt(1);

        if(a.t=='number' && b.t=="number"){
            if(expr.t=="+") return {t:"number", val:a.val+b.val};
            if(expr.t=="-") return {t:"number", val:a.val-b.val};
            if(expr.t=="*") return {t:"number", val:a.val*b.val};
            if(expr.t=="/") return {t:"number", val:a.val/b.val};
            if(expr.t=="//") return {t:"number", val:(a.val-a.val%b.val)/b.val};
            if(expr.t=="%") return {t:"number", val:a.val%b.val};
            if(expr.t=="**") return {t:"number", val:a.val**b.val};
        }

        // One of a or b, or both, (not none, else we wouldn't be still there) is decimal
        if(b.t=="decimal" || a.t=="decimal"){
            let va;
            if(a.t=="decimal"){
                va=a.val;
            }else{
                va=Decimal(a.val);
            }
            if(expr.t=="+") return {t:"decimal", val:va.plus(b.val)};
            if(expr.t=="-") return {t:"decimal", val:va.minus(b.val)};
            if(expr.t=="*") return {t:"decimal", val:va.mul(b.val)};
            if(expr.t=="/") return {t:"decimal", val:va.div(b.val)};
            if(expr.t=="//") return {t:"decimal", val:va.dividedToIntegerBy(b.val)};
            if(expr.t=="%") return {t:"decimal", val:va.mod(b.val)};
            if(expr.t=="**") return {t:"decimal", val:va.pow(b.val)};
        }

        throw {error:"interne", name:"Erreur interne", msg:"Hein?", ln:expr.ln};
    }

    if(expr.t=="in"){
        let e=evaluate(expr.left);
        let set=evaluate(expr.right);
        if(set.t=="array"){
            for(let b of set.val){
                if(isEq(e,b)) return TRUE;
            }
            return FALSE;
        }
        if(set.t=="matrix"){
            if(!isNumeric(e)) return FALSE;
            let v=numericValue(e);
            let n=set.val.length;
            for(let i=0; i<n; i++){
                for(let j=0; j<n; j++){
                    if(set.val[i][j]==v) return TRUE;
                }
            }
            return FALSE;
        }
        if(set.t=="string"){
            if(e.t!="string") return FALSE;
            if(set.val.indexOf(e.val)>=0) return TRUE;
            return FALSE;
        }
        throw {error:"type", name:"Erreur de type", 
               msg:`Mauvais type ${set.t} pour "in". Doit être de type tableau, matrice ou chaîne`, ln:expr.ln};
    }

    // "!"
    if(expr.t=="!"){
        let a=evaluate(expr.right);
        if(a.t=='None') a=FALSE;
        if(a.t!="boolean")
            throw {error:"type", name:"Valeur non booléenne",
                msg:"L'opérateur ! s'utilise sur un argument booléen", ln:expr.ln};
        if(a.val) return FALSE;
        return TRUE;
    }

    if(expr.t=="call"){
        let v=interpCall(expr);
        if(v===undefined || v.t=="empty") throw {error:"type", name:"Pas de valeur de retour",
            msg:"La fonction "+expr.f+" n'a retourné aucune valeur",
            ln:expr.ln};
        return v;
    }

    if(expr.t=="SOMMET"){
        let g=Env.getGraph(expr.g);
        let v=evalSommet(expr.arg, true, g);
        if(!v || v.t!="Sommet") throw {error:"type", name:"Pas un sommet", 
            msg:"Un "+v.t+" n'est pas un sommet valide", ln:expr.arg.ln};
        return v;
    }

    if(expr.t=="field"){
        let o=evaluate(expr.o);
        return getField(o, expr.f, expr.ln);
    }

    if(expr.t=="index"){
        let tab=evaluate(expr.tab);
        let idx=evaluate(expr.index);
        // If index is a string, it is a field access in disguise
        if(idx.t=='string') return getField(tab, idx.val, expr.ln);
        if(!isNumeric(idx)) throw {error:"type", name:"Erreur de type", msg:"Index non entier", ln:expr.index.ln};
        let i=numericValue(idx);
        // Real array in which to index (array or string=>val. For Sommet, it's its name)
        let F=function(t,i){let j=i; if(j<0) j+=t.length; return t[j]};
        let E=function(t,v){if(v===undefined) return NONE; return {t:t, val:v};};
        let R=function(v){if(v===undefined) return NONE; else return v;};
        if(tab.t=="Sommet") return E("string", F(tab.name, i));
        if(tab.t=="string") return E("string", F(tab.val, i));
        if(tab.t=="array") return R(F(tab.val, i));
        throw {error:"type", name:"Type non indexable", msg:"Un objet de type "+tab.t+" ne peut être indexé", ln:expr.ln};
    }
    if(expr.t=="mindex"){
        let i=evaluate(expr.i);
        let j=evaluate(expr.j);
        let M=evaluate(expr.mat);
        if(M.t!="matrix") throw {error:"type", name:"Erreur de type",
            msg:"Utilisation d'un "+M.t+" comme une matrice", ln:expr.ln};
        if(!isNumeric(i)) throw {error:"type", name:"Erreur de type",
            msg:"Indice de ligne non entier", ln:expr.i.ln};
        if(!isNumeric(j)) throw {error:"type", name:"Erreur de type",
            msg:"Indice de colonne non entier", ln:expr.j.ln};
        let n=M.val.length;
        let ii=numericValue(i);
        let jj=numericValue(j);
        if(ii>=n || jj>=n) throw {error:"index", name:"Index trop grand",
                                 msg:`Index [${ii},${jj}] trop grand pour une matrice de taille ${n}`, 
                                 ln:expr.j.ln};
        return {t:"number", val:M.val[ii][jj]};
    }
    if(expr.t=="array"){
        return JSON.parse(JSON.stringify(expr));
    }
    if(expr.t=="struct"){
        return JSON.parse(JSON.stringify(expr));
    }
    if(expr.t=="subarray"){
        let tab=evaluate(expr.tab);
        let rtab=false;
        if(tab.t=="array") rtab=tab.val;
        else if(tab.t=="string") rtab=tab.val;
        else if(tab.t=="Sommet") rtab=tab.name;
        else throw {error:"type", name:"Erreur de type", msg:`Utilisation de [...:...] sur un objet (type ${tab.t}) non indexable`, ln:expr.tab.ln};
        let b0=0;
        let b1=false;
        if(expr.indexinf){
            let idinf=evaluate(expr.indexinf);
            if(!isNumeric(idinf)) throw {error:"type", name:"Index de tableau non entier", msg:"", ln:expr.indexinf.ln};
            b0 = numericValue(idinf);
            if(b0<0) b0+=rtab.length;
        }
        if(expr.indexsup){
            let idsup=evaluate(expr.indexsup);
            if(!isNumeric(idsup)) throw {error:"type", name:"Index de tableau non entier", msg:"", ln:expr.indexinf.ln};
            b1 = numericValue(idsup);
            if(b1<0) b1+=rtab.length;
        }
        let nv=false;
        if(b1===false) nv=rtab.slice(b0);
        else nv=rtab.slice(b0,b1);
        if(tab.t=="array") return {t:"array", val:nv};
        else return {t:"string", val:nv};
    }
    if(expr.t=="staticArray"){
        let l=[];
        for(let a of expr.args){
            l.push(evaluate(a));
        }
        return {t:"array", val:l};
    }
    if(expr.t=="Arc"){
        return creerArc(expr);
    }
    if(expr.t=="Arete"){
        return creerArete(expr);
    }
    if(expr.t=="Graphe"){
        return evalGraphe(expr, true);
    }
    // Ternary operator
    if(expr.t=="?:"){
        let c=evaluate(expr.cond);
        if(c.t!='boolean') throw {error:'type', name:'Erreur de type', 
            msg:`L'opérateur cond?oui:non s'utilise avec une condition booléenne, pas «${cond.t}»`, ln:expr.ln};
        if(c.val) return evaluate(expr.oui);
        return evaluate(expr.non);
    }
    console.trace("Cannot evaluate", expr);
}

// Comparaison (égalité ou différence)
// Pour les valeurs scalaires, compare la valeur. Pour les sommets et arcs, la référence suffit
// Pour les vecteurs et structures : comparaison récursive
function isEq(a,b){
    Env.addCnt(1);
    // Comparaison avec chaine d'un sommet
    if(a.t=="string" && b.t=="Sommet") return a.val==b.name;
    if(a.t=="Sommet" && b.t=="string") return a.name==b.val;
    // Comparaison entre décimal et nombre (aucune garantie d'absence d'erreur numérique)
    // Gère aussi le cas decimal/decimal
    if(a.t=="decimal" && isNumeric(b)) return a.val.equals(b.val);
    if(b.t=="decimal" && isNumeric(a)) return b.val.equals(a.val);
    // En dehors de ces deux cas, deux données de types différent sont différentes
    if(a.t!=b.t) return false;
    // A ce point, nous savons que a et b sont de mêmes types
    if(a.t=="None") return true;  // le type lui même suffit
    if(a.t=="Sommet" || a.t=="Arete" || a.t=="Arc") return a===b;
    if(a.t=="boolean" || a.t=="number" || a.t=="string") return a.val==b.val;
    // Pour les tableaux, la comparaison est "profonde"
    if(a.t=="array"){
        if(a.val.length!=b.val.length) return false;
        for(let i=0; i<a.val.length; i++){
            if(!isEq(a.val[i], b.val[i])) return false;
        }
        Env.addCnt(a.val.length-1);
        return true;
    }
    // Idem pour les matrices. Si ce n'est qu'il n'y a pas besoin de rappeler récursivement isEq, 
    // puisque le contenu est forcément numérique
    if(a.t=="matrix"){
        for(let i=0; i<a.val.length; i++){
            for(let j=0; j<a.val.length; j++){
                if(a.val[i][j] != b.val[i][j]) return false;
            }
        }
        Env.addCnt(a.val.length*a.val.length-1);
        return true;
    }
    // Enfin pour les struct, il faut comparer les champs
    if(a.t=="struct"){
        for(let f in a.f) if(b.f[f]===undefined) return false; // un champ de a n'existe pas dans b
        for(let f in b.f) if(a.f[f]===undefined) return false; // un champ de b n'existe pas dans a
        for(let f in a.f) if(!isEq(a.f[f], b.f[f])) return false; // 1 champ a des valeurs différents dans a et b
        return true;
    }
}
function evaluateEqual(expr){
    // Si c'est un ==, la λ retoure TRUE si c'est égal
    if(expr.t=="==") expr.l=function(){ 
        if(isEq(evaluate(expr.left), evaluate(expr.right))) return TRUE;
        else return FALSE;
    }
    // Sinon elle retoure FALSE
    else expr.l=function(){
        if(isEq(evaluate(expr.left), evaluate(expr.right))) return FALSE;
        else return TRUE;
    }
    return expr.l();
}

// Subfunction for arc (as expression) evaluation
// Outside `Arc (a,b)` declarations, or l-value `(a,b)`, which should not be treated as expressions,
// the only case where `(a,b)` or `[a,b]` may appear 
// in the code are `(a,b)` where a previous `(a,b)` as l-value has been defined
function evaluateArc(expr){
    // Has been dealt as a l-value by parser. But is a R-value from interpreter point of view. So translate it as R-value
    if(expr.t=="lvarc" || expr.t=="lvarete"){
        if(expr.t=="lvarc") expr.t="arc";
        else expr.t="arete";
        expr.initial={t:"id", name:expr.initial, ln:expr.ln};
        expr.terminal={t:"id", name:expr.terminal, ln:expr.ln};
    }
    // If both nodes are ID, then it might be a previously l-val edge, that is a variable of its own
    if(expr.initial.t=='id' && expr.terminal.t=='id'){
        // A name (that cannot legally be a real name) for the arc/arete variable
        let cn=((expr.t=="arc")?">":"-") + expr.initial.name + "," + expr.terminal.name; 
        let w=Env.get(cn); // Edge itself
        let s1=Env.get(expr.initial.name);
        let s2=Env.get(expr.terminal.name);
        // If arc exist in env (as previous l-val), that is if (a,b)=... has been previously done
        if(w && (w.t=="Arc"||w.t=="Arete"||w.t=="None")) {
            // And if nodes hasn't changed since (we could have (a,b)=... then a=...
            if(s1==w.i && s2==w.a) return w;
        }
    }

    // So, if we are still here, it is either because arc doesn't exist as itself (no (a,b)=...), or because 
    // it did, but nodes has changed ((a,b)=... then a=...)
    // Or because it is a general expression edge (expr, expr) or [expr, expr]
    let s1=evaluate(expr.initial);
    let s2=evaluate(expr.terminal);

    // No chance if s1 and s2 are not nodes
    if(s1===undefined || s2===undefined || s1.t!="Sommet" || s2.t!="Sommet"){
        throw {error:"type", name:"Pas un arc ou une arête", 
            msg:"La paire ne correspond pas à un arc ou une arête", ln:expr.ln};
    }

    let graphe = Env.grapheContaining(s1);
    if(graphe===null) return NONE;
    for(let a of graphe.arcs){
        if(a.i===s1 && a.a===s2) return a; // a is (s1,s2) or [s1,s2]
        if(expr.t=="arete" && a.a===s1 && a.i===s2) return a;  // or [s2,s1] 
    }
    return NONE;
}


// Return a pointer to a L-value
// A L-value is represented by a mutable pair oject/index. That is that object[index] should be modifiable
// So it could be Local[varname], Global[varname], struct[fieldname], array[index], Graphe[nodeName]...
// Since nodes and edges behave like a field, it could also be nodeAttributes[fieldName], and the like
// Because edges can also be l-value (we can write (a,b)=(S1,S2), or `for [a,b] in aretes():`), 
// and in such case, both the edge (a,b), and the nodes a and b can be affected, 
// such L-value takes a special form of a 6-uplets, 2 first elements being the l-value of first node, 2 next, second node, and last 2 the edge itself
export function evaluateLVal(lv, direct){

    if(lv.t=="id") { // Just an identifier: a=  Note that getIdLv(...) would raise an error if that identifier is not mutable (predef)
        return [Env.getIdlv(lv.name, lv.ln), lv.name];
    }


    // Special case of arc/arete (edges) -> return a 6-uplet
    else if(lv.t=="lvarc" || lv.t=="lvarete") { // (a,b)= ou [a,b]=
        let a=Env.getIdlv(lv.initial, lv.ln);
        let b=Env.getIdlv(lv.terminal, lv.ln);
        let cn=((lv.t=="lvarc")?">":"-") + lv.initial + "," + lv.terminal; // A name (that cannot legally be a real name) for the arc/arete variable
        let c=Env.getIdlv(cn, lv.ln); // Env for new local var (so local or global depending on scope). Shouldn't be anything else than Current (can't be declared as global)
        return [a, lv.initial, b, lv.terminal, c, cn]; // 6-uple for arc l-val, made of both node and the arc/arete itself
    }

    // Case of `.` operator. That is l-value is a.f. a could be a struct, a node, an edge (`(a,b).f`), or a graph
    else if(lv.t=="field") { // a.f=
        let v=evaluate(lv.o);

        if(v.t=="Sommet"){ // Soit un sommet, soit un arc. Le champ fait donc référence à une marque
            // If it is an attribute that change graph appearance, mark graph for change
            if(lv.f=="color" || lv.f=="val" || lv.f=="label") Env.grapheContaining(v).change=true; 
            return [v.marques, lv.f]; // Sommet
        }
        else if(v.t=="Arete"){
            if(lv.f=="color" || lv.f=="val" || lv.f=="label") Env.grapheContaining(v.i).change=true;
            return [v.marques, lv.f]; // Arete, dans une variable (et non en tant que paire)
        }
        else if(v.t=="Arc"){
            if(lv.f=="color" || lv.f=="val" || lv.f=="label") Env.grapheContaining(v.i).change=true;
            return [v.marques, lv.f];
        }
        else if(v.t=="Graphe"){
            return [v.sommets, lv.f];
        }
        else if(v.t=="struct"){ // Struct
            return [v.f, lv.f];
        }
        // Anything else is an error
        throw {error:"type", name:"Pas une structure", 
            msg:"tentative d'accéder à un champ d'un objet de type "+v.t, ln:lv.ln};
    }

    // Array element
    else if(lv.t=="index"){ // a[12]=
        let v=evaluate(lv.tab);
        if(v.t!="array") throw{error:"type", name:"Pas un tableau", msg:"Un "+v.t+" n'est pas un tableau",ln:lv.ln};
        let i=evaluate(lv.index);
        if(i===undefined || !isNumeric(i)){
            throw {error:"type", name:"Index invalide", msg:"Un élément de type '"+i.t+"' n'est pas un index valide pour un tableau", ln:lv.index.ln};
        }
        let j=numericValue(i);
        if(j<0) j+=v.val.length;
        return [ v.val, j ];
    }

    // Matrix element
    else if(lv.t=="mindex"){ // M[1,2]=...
        let v=evaluate(lv.mat);
        if(v.t!="matrix") throw{error:"type", name:"Erreur de type", msg:"Pas une matrice", ln:lv.ln};
        let i=evaluate(lv.i);
        let j=evaluate(lv.j);
        if(i===undefined || !isNumeric(i)){ 
            throw {error:"type", name:"Index de ligne invalide",
                msg:"Un élément de type "+i.t+" n'est pas un index de ligne valide", ln:lv.i.ln};
        }
        if(j===undefined || !isNumeric(j)){
            throw {error:"type", name:"Index de colonne invalide",
                msg:"Un élément de type "+j.t+" n'est pas un index de colonne valide", ln:lv.j.ln};
        }
        return [ v.val[numericValue(i)], numericValue(j) ];
    }
    else throw {error:"interne", name:"Erreur interne", msg:"EvaluateLVal appelé sur non-LValue", ln:lv.ln};
}

// For mixed cases, where a l-value is also an expression. So far, only for ++ --
function getRef(ref){
   // Only for case such as matrix[i,j]++
   if(typeof ref[0][ref[1]] == "number") return {t:"number", val:ref[0][ref[1]]};
   return ref[0][ref[1]];
}

