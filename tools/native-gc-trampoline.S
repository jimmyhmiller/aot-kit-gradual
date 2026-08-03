.text
.p2align 2
.globl _aot_gc_enter
_aot_gc_enter:
  sub sp, sp, #16
  stp x28, x30, [sp]
  mov x9, x0
  adrp x28, _aot_gc_thread_state@PAGE
  add x28, x28, _aot_gc_thread_state@PAGEOFF
  blr x9
  ldp x28, x30, [sp]
  add sp, sp, #16
  ret

.p2align 2
.globl _aot_gc_enter1
_aot_gc_enter1:
  sub sp, sp, #16
  stp x28, x30, [sp]
  mov x9, x0
  mov x0, x1
  adrp x28, _aot_gc_thread_state@PAGE
  add x28, x28, _aot_gc_thread_state@PAGEOFF
  blr x9
  ldp x28, x30, [sp]
  add sp, sp, #16
  ret

.p2align 2
.globl _aot_alloc_slow
_aot_alloc_slow:
  sub sp, sp, #96
  stp x19, x20, [sp, #0]
  stp x21, x22, [sp, #16]
  stp x23, x24, [sp, #32]
  stp x25, x26, [sp, #48]
  stp x27, x28, [sp, #64]
  stp x29, x30, [sp, #80]
  mov x2, sp
  add x3, sp, #96
  mov x4, x30
  bl _aot_gc_alloc
  cbnz x0, 1f
  bl _aot_gc_oom_trap
  brk #0
1:
  ldp x19, x20, [sp, #0]
  ldp x21, x22, [sp, #16]
  ldp x23, x24, [sp, #32]
  ldp x25, x26, [sp, #48]
  ldp x27, x28, [sp, #64]
  ldp x29, x30, [sp, #80]
  add sp, sp, #96
  ret
