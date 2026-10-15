.intel_syntax noprefix

.section .text
.type main, @function
main:
    push rbp
    mov rbp, rsp
.L0_0:
    mov rax, 1
    leave
    ret
.size main, .-main
