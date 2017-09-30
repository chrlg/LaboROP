%lex

%{
%}
%x string
%x stringq

%%

"#".*			/* Ignore */
" "+			/* Ignore */
[\n]			return ";"

"§{"			return "BEGIN";
"§}"			return "END";
"§;"			return ";"

[0-9]+("."[0-9]+)?("E"[0-9]+)?\b	return 'NUMBER'

["]			this.begin("string"); _clg_stringBuf="";
<string>["]		this.popState(); yytext=_clg_stringBuf; return "STRING";
<string>[^"\\\n]	_clg_stringBuf += yytext;
<string>"\\n"		_clg_stringBuf += "\n";
<string>"\\"[^\n]		_clg_stringBuf += yytext.slice(1);

[']			this.begin("stringq"); _clg_stringBuf="";
<stringq>[']		this.popState(); yytext=_clg_stringBuf; return "STRING";
<stringq>[^'\\\n]	_clg_stringBuf += yytext;
<stringq>"\\n"		_clg_stringBuf += "\n";
<string>"\\"[^\n]	_clg_stringBuf += yytext.slice(1);

"+="			return "+="
"++"			return "++"
"--"			return "--"
"=="			return "=="

"="			return "="
"["			return "["
"]"			return "]"
","			return ","
"("			return "("
")"			return ")"
":"			return ":"
"."			return "."
"+"			return "+"

"Sommet"		return "Sommet"
"Arete"			return "Arete"
"Gamma"			return "Gamma"
"def"			return "def"
"for"			return "for"
"while"			return "while"
"if"			return "if"
"else"			return "else"
"continue"		return "continue"
"break"			return "break"
"in"			return "in"
"global"		return "global"

[A-Za-z_][A-Za-z0-9_]*	return "ID"

<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

%left "=="
%left '+' '-'
%left '*' '/'
%right '!'

%start program

%% 

id 
      : ID {
	 $$ = {t:"id", name:$1, ln:@1.first_line};
      }
      ;

instruction
      : Sommet listeExpr {
	 $$ = { t:"SOMMET", args:$2, ln:@1.first_line} ;
      }
      | Arete "[" expr "," expr "]" {
	 $$ = { t:"ARETE", left: $3, right: $5};
      }
      | lvalue "=" expr {
	 $$ = { t:"=", left: $1, right:$3};
      }
      | lvalue "+=" expr {
	 $$ = { t:"+=", left: $1, right: $3, ln:@2.first_line};
      }
      | ID '(' ')' {
	 $$ = { t:"call", f:$1, args:[]};
      }
      | ID '(' listeExpr ')' {
	 $$ = { t:"call", f:$1, args:$3};
      }
      | for lvalue "in" expr ":" blocOuSingle {
	 $$ = { t:"for", compteur:$2, range:$4, do:$6};
      }
      | while expr ":" blocOuSingle {
	 $$ = { t:"while", cond:$2, do:$4 };
      }
      | if expr ":" blocOuSingle {
	 $$ = { t:"if", cond:$2, do:$4, else:[] };
      }
      | if expr ";" blocOuSingle ";" else blocOuSingle {
	 $$ = { t:"if", cond:$2, do:$4, sinon:$7 };
      }
      | break {
	 $$ = {t:"break"};
      }
      | continue {
	 $$ = {t:"continue"};
      }
      ;

listeExpr
      : expr {
	 $$ = [$1];
      } | listeExpr "," expr {
	 $$ = $1; $$.push($3);
      }
      ;

expr
      : lvalue {
	 $$=$1;
      }
      | STRING {
	 $$={t:"string", val:$1, ln:@1.first_line};
      }
      | NUMBER {
	 $$={t:"number", val:$1, ln:@1.first_line};
      }
      | expr "==" expr {
	 $$ = {t:"==", left:$1, right:$3};
      }
      | expr "+" expr {
	 $$ = {t:"+", left:$1, right:$3, ln:@2.first_line};
      }
      | ID '(' ')' {
	 $$={t: "call", f:$1, args:[]};
      }
      | ID '(' listeExpr ')' {
	 $$={t: "call", f:$1, args:$3};
      }
      ;

lvalue
      : id {
	 $$=$1;
      } 
      | "Gamma" "(" expr ")" {
	 $$={t: "Gamma", arg: $3};
      }
      | "(" ID "," ID ")" {
	 $$={t: "arc", initial:$2, terminal:$4};
      }
      | "[" expr "," expr "]" {
	 $$={t:"arete", left: $2, right: $4};
      }
      | lvalue "." ID {
	 $$={t: "field", o:$1, f:$3};
      }
      ;

blocOuSingle
      : instruction {
	 $$ = [$1];
      }
      | ";" "BEGIN" listInst "END" {
	 $$ = $3;
      }
      ;

listInst 
      : {
	 $$ = [];
      }
      | ";" listInst {
	 $$=$2;
      }
      | instruction ";" listInst {
	 $$ = $3;
	 $$.unshift($1);
      }
      ;

definition
      : "def" ID listArgs ":" blocOuSingle {
	 $$ = {t:"DEF", nom: $2, args:$3, insts: $5, ln:@1.first_line};
      }
      ;

listArgs
      : "(" ")" {
	 $$=[];
      }
      | "(" listID ")" {
	 $$=$2;
      }
      ;

listID 
      : ID {
	 $$=[$1];
      }
      | ID "," listID {
	 $$=$3;
	 $$.unshift($1);
      }
      ;

listeInstOuDef
      : EOF {
	 $$ = [];
      }
      | instruction ";" listeInstOuDef {
	 $$ = $3;
	 $$.unshift($1);
      } 
      | definition ";" listeInstOuDef {
	 $$ = $3;
	 $$.unshift($1);
      } 
      | ";" listeInstOuDef {
	 $$=$2;
      }
      ;

program
      : listeInstOuDef { 
	 return $1;
      }
      ;


%%

