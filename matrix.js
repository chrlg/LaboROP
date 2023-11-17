import * as Env from "./environment.js";

export function zeroDim(n){
   let M={t:"matrix", val:[]};
   for(let i=0; i<n; i++){
      M.val[i]=new Array(n).fill(0);
   }
   return M;
}

export function id(n){
    let M={t:"matrix", val:[]};
    for(let i=0; i<n; i++){
        M.val[i]=new Array(n).fill(0);
        M.val[i][i]=1;
    }
    return M;
}

export function sum(a, b){
    let n=a.val.length;
    let R=zeroDim(n);
    for(let i=0; i<n; i++){
        for(let j=0; j<n; j++){
            R.val[i][j] = (a.val[i][j]!=0 || b.val[i][j]!=0)?1:0;
        }
    }
    Env.addCnt(n*n);
    return R;
}

export function mul(a,b){
   let R={t:"matrix", val:new Array(a.val.length)};
   let n=a.val.length;
   for(let i=0; i<n; i++){
      R.val[i]=new Array(n).fill(0);
      for(let j=0; j<n; j++){
         for(let k=0; k<n; k++){
            R.val[i][j] += a.val[i][k]*b.val[k][j];
         }
      }
   }
   Env.addCnt(2*n*n*n);
   return R;
}

export function pow(a, k){
    if(k==0) return id(a.val.length);
    if(k==1) return a;
    let H=pow(a, Math.trunc(k/2));
    let HH=mul(H,H);
    if(k%2) return mul(HH,a);
    return HH;
}

export function boolMul(a,b){
    let n=a.val.length;
    let R=zeroDim(n);
    for(let i=0; i<n; i++){
        for(let j=0; j<n; j++){
            for(let k=0; k<n; k++){
                if(a.val[i][k]!=0 && b.val[k][j]!=0){
                    R.val[i][j]=1;
                    break;
                }
            }
        }
    }
    Env.addCnt(2*n*n*n);
    return R;
}



export function boolPow(a,k){
    if(k==0) return id(a.val.length);
    if(k==1) return a;
    let H=boolPow(a, Math.trunc(k/2));
    let HH=boolMul(H,H);
    if(k%2) return boolMul(HH,a);
    return HH;
}

