.text
.p2align 2
.globl _aot_gc_enter_fp1
_aot_gc_enter_fp1:
  sub sp, sp, #16
  stp x28, x30, [sp]
  mov x9, x0
  adrp x28, _aot_gc_thread_state@PAGE
  add x28, x28, _aot_gc_thread_state@PAGEOFF
  blr x9
  ldp x28, x30, [sp]
  add sp, sp, #16
  ret
