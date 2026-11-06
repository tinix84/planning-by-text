+ALPHA ~900h
+ALPHA.pfc.design "PFC design" ~328h ?POW 2024-01..2024-02
+ALPHA.pfc.test   "PFC test"   ~164h ?POW:50% ?DSP:50% after:.design
+ALPHA.llc        "LLC"        ~200h ?POW
@bob +ALPHA.pfc.test 50%   # requested by PM
