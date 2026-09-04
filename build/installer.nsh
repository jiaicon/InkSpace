; 安装目录选择增强：用户在「浏览」里选中目录后，自动在末尾补上应用名子目录（InkSpace），
; 避免把程序文件直接散落到所选目录根下；补上之后用户仍可在目录框里手动改成别的路径。
;
; 说明：electron-builder 模板自身在 instFilesPre 里也有追加逻辑，但发生在目录页之后，
; 用户看不到结果；这里改用 .onVerifyInstDir，在离开目录页时就修正 $INSTDIR，行为更直观。
; ${APP_FILENAME} 由 electron-builder 注入，本项目即 "InkSpace"（取 productName）。
Function .onVerifyInstDir
  ; 计算 "\应用名" 的长度（如 \InkSpace），取 $INSTDIR 末尾等长的子串
  StrLen $0 "\${APP_FILENAME}"
  StrCpy $1 "$INSTDIR" "" -$0
  ; 若末尾已是 "\应用名" 则跳过，否则补上
  StrCmp $1 "\${APP_FILENAME}" +2 0
  StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
FunctionEnd
