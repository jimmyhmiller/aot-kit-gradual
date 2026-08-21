#if defined(__x86_64__) && !defined(__APPLE__)
.text
.globl aot_gc_enter
.type aot_gc_enter,@function
aot_gc_enter:
  pushq %r12
  movq %rdi, %rax
  leaq aot_gc_thread_state(%rip), %r12
  call *%rax
  popq %r12
  ret
.size aot_gc_enter, .-aot_gc_enter

.globl aot_gc_enter1
.type aot_gc_enter1,@function
aot_gc_enter1:
  pushq %r12
  movq %rdi, %rax
  movq %rsi, %rdi
  leaq aot_gc_thread_state(%rip), %r12
  call *%rax
  popq %r12
  ret
.size aot_gc_enter1, .-aot_gc_enter1

.globl aot_alloc_slow
.type aot_alloc_slow,@function
aot_alloc_slow:
  pushq %rbp
  movq %rsp, %rbp
  pushq %rbx
  pushq %r12
  pushq %r13
  pushq %r14
  pushq %r15
  subq $8, %rsp
  movq %rsp, %rdx
  leaq 48(%rsp), %rcx
  movq 8(%rbp), %r8
  call aot_gc_alloc
  testq %rax, %rax
  jne 1f
  call aot_gc_oom_trap
  ud2
1:
  addq $8, %rsp
  popq %r15
  popq %r14
  popq %r13
  popq %r12
  popq %rbx
  popq %rbp
  ret
.size aot_alloc_slow, .-aot_alloc_slow

.section .note.GNU-stack,"",@progbits
#else
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
#endif
