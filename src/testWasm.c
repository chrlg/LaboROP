#include <emscripten/emscripten.h>

static int count=423;
EMSCRIPTEN_KEEPALIVE int hw(){
    return count++;
}
