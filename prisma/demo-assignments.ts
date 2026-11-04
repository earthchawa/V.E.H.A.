/** Demo content for `npm run db:seed:demo`. Submissions 1/2 (code) and 1/4 (essay) are deliberately similar. */

// Given to every cadet, so it is set as the assignment's starter text and ignored by the check.
const starter = `class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None
`;

const original = `class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None
        self.size = 0

    def push_front(self, value):
        node = Node(value)
        node.next = self.head
        self.head = node
        self.size += 1

    def find(self, value):
        current = self.head
        while current is not None:
            if current.data == value:
                return current
            current = current.next
        return None

    def remove(self, value):
        prev, current = None, self.head
        while current is not None and current.data != value:
            prev, current = current, current.next
        if current is None:
            return False
        if prev is None:
            self.head = current.next
        else:
            prev.next = current.next
        self.size -= 1
        return True
`;

// Same program with renamed identifiers and new comments.
const renamed = `# Lab 3 - my implementation
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedList:
    def __init__(self):
        self.first = None
        self.count = 0

    def push_front(self, item):
        # create new node and put it at the front
        n = Node(item)
        n.next = self.first
        self.first = n
        self.count += 1

    def find(self, item):
        cur = self.first
        while cur is not None:
            if cur.data == item:
                return cur
            cur = cur.next
        return None

    def remove(self, item):
        before, cur = None, self.first
        while cur is not None and cur.data != item:
            before, cur = cur, cur.next
        if cur is None:
            return False
        if before is None:
            self.first = cur.next
        else:
            before.next = cur.next
        self.count -= 1
        return True
`;

const different = `class Node:
    def __init__(self, data):
        self.data = data
        self.link = None

class LinkedList:
    def __init__(self):
        self.head = None

    def push_front(self, value):
        self.head = Node(value) if self.head is None else self._prepend(value)

    def _prepend(self, value):
        new_head = Node(value)
        new_head.link = self.head
        return new_head

    def to_list(self):
        out = []
        node = self.head
        for _ in iter(int, 1):
            if not node:
                break
            out.append(node.data)
            node = node.link
        return out

    def find(self, value):
        return next((x for x in self.to_list() if x == value), None)
`;

const essayShared =
  "ลิงก์ลิสต์เหมาะกับงานที่ต้องเพิ่มหรือลบข้อมูลบ่อย เพราะเพียงเปลี่ยนตัวชี้ของโหนดข้างเคียงก็ทำได้ทันทีโดยไม่ต้องเลื่อนข้อมูลตัวอื่น " +
  "ในขณะที่อาร์เรย์ต้องขยับสมาชิกทุกตัวที่อยู่ถัดไป ทำให้การแทรกข้อมูลตรงกลางมีความซับซ้อนเชิงเวลาเป็นโอของเอ็น";

type DemoSubmission = { username: string; text?: string; file?: { name: string; text: string } };
type DemoAssignment = {
  title: string;
  instructions: string;
  baseText: string | null;
  dueInDays: number;
  submissions: DemoSubmission[];
};

export const DEMO_ASSIGNMENTS: DemoAssignment[] = [
  {
    title: "Lab 3: Linked list (Python)",
    instructions:
      "Implement a singly linked list with push_front, find and remove.\nSubmit a single .py file. Starter code is provided — you don't need to change the class signatures.",
    baseText: starter,
    dueInDays: 7,
    submissions: [
      { username: "6601001", file: { name: "linked_list.py", text: original } },
      { username: "6601002", file: { name: "lab3.py", text: renamed } },
      { username: "6601003", file: { name: "lab3_linkedlist.py", text: different } },
    ],
  },
  {
    title: "Essay: Arrays vs. linked lists",
    instructions: "เขียนเรียงความ 1 หน้า เปรียบเทียบอาร์เรย์กับลิงก์ลิสต์ ยกตัวอย่างงานที่เหมาะกับแต่ละแบบ",
    baseText: null,
    dueInDays: 10,
    submissions: [
      {
        username: "6601001",
        text:
          "อาร์เรย์เก็บข้อมูลเรียงต่อกันในหน่วยความจำ จึงเข้าถึงสมาชิกตำแหน่งใดก็ได้ในเวลาคงที่ เหมาะกับงานที่อ่านข้อมูลตามตำแหน่งบ่อย เช่น ตารางคะแนน\n\n" +
          essayShared +
          "\n\nสรุปคือควรเลือกโครงสร้างข้อมูลตามลักษณะการใช้งานจริงของระบบ",
      },
      {
        username: "6601004",
        text:
          "ในการเลือกโครงสร้างข้อมูล ต้องดูว่าโปรแกรมอ่านหรือแก้ไขข้อมูลบ่อยกว่ากัน\n\n" +
          essayShared +
          "\n\nตัวอย่างเช่นคิวของเครื่องบินที่รอขึ้นบิน ซึ่งมีการเพิ่มและนำออกตลอดเวลา จึงเหมาะกับลิงก์ลิสต์มากกว่า",
      },
      {
        username: "6601005",
        text:
          "อาร์เรย์และลิงก์ลิสต์ต่างกันที่วิธีจัดเก็บในหน่วยความจำ อาร์เรย์จองพื้นที่ต่อเนื่องล่วงหน้า ส่วนลิงก์ลิสต์จองทีละโหนดเมื่อต้องการ " +
          "ข้อเสียของลิงก์ลิสต์คือใช้หน่วยความจำเพิ่มสำหรับตัวชี้ และค้นหาข้อมูลได้ช้ากว่าเพราะต้องไล่จากหัวรายการ " +
          "สำหรับระบบบันทึกชั่วโมงบินของนักบินซึ่งอ่านบ่อยแต่แก้ไขน้อย อาร์เรย์จึงเหมาะสมกว่า",
      },
    ],
  },
];
