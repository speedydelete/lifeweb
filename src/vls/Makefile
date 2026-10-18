ASAN ?= 0
NO_OPTIMIZE ?= 0
USE_GCC ?= 0

ifeq ($(ASAN), 1)
    CC = gcc
else ifeq ($(USE_GCC), 1)
    CC = gcc
else
    CC = clang
endif

CFLAGS = -fdiagnostics-color=always -Wall -Werror -Wpedantic -Wextra -Wno-unknown-pragmas -g

ifeq ($(CC), gcc)
    CFLAGS += -std=c2x
else
    CFLAGS += -std=c23 -Wno-gnu-zero-variadic-macro-arguments -Wno-gnu-binary-literal
endif

ifneq ($(NO_OPTIMIZE), 1)
    CFLAGS += -O3 -march=native -mtune=native -flto -fno-stack-protector -fomit-frame-pointer
endif

ifeq ($(ASAN), 1)
    CFLAGS += -fsanitize=address
endif

SRC = src/vls/c/index.c
TARGET = src/vls/.vls_compiled
LDFLAGS = -lm

TRACKED_FILES = $(shell find src/vls/c -type f)

BUILD_COMMAND_FILE = src/vls/.build_command
BUILD_COMMAND = $(CC) $(CFLAGS) -o $(TARGET) $(SRC) $(LDFLAGS)

ifneq ($(shell cat $(BUILD_COMMAND_FILE) 2>/dev/null), $(BUILD_COMMAND))
$(shell echo '$(BUILD_COMMAND)' > $(BUILD_COMMAND_FILE))
endif

main: $(TARGET)

$(TARGET): $(TRACKED_FILES) $(BUILD_COMMAND_FILE)
	$(BUILD_COMMAND)
