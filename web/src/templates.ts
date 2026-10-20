// Clean, pristine starter skeletons for participants (LeetCode style)
// Participants must write their own solutions. Solutions are NEVER leaked here.

export const STARTER_BOILERPLATES: Record<string, string> = {
  'cpp23-gcc': `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Write your solution here

    return 0;
}
`,
  'cpp23-clang': `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Write your solution here

    return 0;
}
`,
  'c23-gcc': `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    // Write your solution here

    return 0;
}
`,
  'c23-clang': `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    // Write your solution here

    return 0;
}
`,
  'python3': `import sys

def solve():
    # Read input from sys.stdin and write your solution here
    pass

if __name__ == '__main__':
    solve()
`,
  'rust': `use std::io::{self, Read};

fn main() {
    // Write your solution here
}
`,
  'go': `package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    // Write your solution here
}
`,
};

export function getBoilerplate(_slug: string, language: string): string {
  if (STARTER_BOILERPLATES[language]) {
    return STARTER_BOILERPLATES[language];
  }
  if (language.startsWith('c23')) {
    return STARTER_BOILERPLATES['c23-gcc'];
  }
  return STARTER_BOILERPLATES['cpp23-gcc'];
}
