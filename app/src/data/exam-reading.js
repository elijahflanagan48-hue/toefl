// Demo Reading module (original content, not from the Official Guide).
// Real modules come from the item bank via the MST engine (stage P8).
// Layout follows the ETS module order: Complete the Words → Daily Life → Academic Passage.

export const demoModule = {
  section: 'Reading', module: 1, minutes: 12,
  sets: [
    {
      type: 'ctw', title: 'Fill in the missing letters in the paragraph.',
      text: 'Coral reefs are built by tiny animals called polyps. Each polyp produces a hard skeleton of calcium carbonate, and over many generations these skeletons form large structures. Reefs provide shelter for thousands of species, which is why scientists often compare them to tropical rainforests. Roughly a quarter of all marine fish depend on reefs at some stage of their lives. However, rising ocean temperatures place reefs under severe stress.'
    },
    {
      type: 'rdl', title: 'Read a notice.',
      doc: {
        kind: 'notice', head: 'Maple Hall Laundry Room',
        body: [
          '<b>Starting Monday, March 3,</b> machines will accept campus cards only. Coins will no longer work.',
          'Add money to your card at the front desk or online. Online deposits can take up to an hour to appear, so plan ahead.',
          'Machines 4 and 7 are out of order until further notice.',
          'Questions? Email <u>housing@maple.edu</u>'
        ]
      },
      qs: [
        { stem: 'What is the main purpose of the notice?', type: 'Factual',
          opts: ['To explain how to repair the machines', 'To announce a change in how students pay', 'To advertise new washing machines', 'To announce new opening hours'], a: 1 },
        { stem: 'What should a student who adds money online do?', type: 'Inference',
          opts: ['Bring coins as a backup', 'Email the housing office first', 'Wait before trying to use a machine', 'Use machine 4 or machine 7'], a: 2 }
      ]
    },
    {
      type: 'rap', title: 'Read a passage about the history of time zones.',
      heading: 'Railroad Time',
      paras: [
        ['Before the late nineteenth century, most towns set their clocks by the sun.', 'Noon was simply the moment when the sun stood highest in the sky, so a town fifty kilometers to the east kept a slightly different time from its neighbor.', 'For centuries, this local system caused few problems because travel between towns was slow.'],
        ['The spread of railroads changed the situation.', 'A single railway line might pass through dozens of local times, and companies printed timetables that confused even their own staff.', 'Missed connections were common, and trains running on the same track sometimes relied on different clocks, which created a serious risk of collision.', 'Railway managers began to look for a simpler system.'],
        ['In 1883, railway companies in the United States and Canada [[adopted]] a set of standard zones, each one hour apart.', 'Many communities resisted at first; some residents saw the change as an attempt by private businesses to control daily life.', 'Nevertheless, the convenience of shared schedules gradually won public acceptance, and the zones were written into federal law in 1918.', 'Today, the idea that time should be coordinated across large regions seems so natural that few people question {{it}}.']
      ],
      qs: [
        { stem: 'According to the passage, why did local time cause few problems for centuries?', type: 'Factual',
          opts: ['Towns were located far from one another.', 'Travel between towns was slow.', 'Most people did not own clocks.', 'Railroads kept their own time.'], a: 1 },
        { stem: 'The word "adopted" in the passage is closest in meaning to', type: 'Vocabulary', hl: 'adopted',
          opts: ['invented', 'debated', 'accepted', 'postponed'], a: 2 },
        { stem: 'Select the sentence in paragraph 2 that explains why local time had become dangerous.', type: 'Select the Sentence',
          select: { para: 1, a: 2 } },
        { stem: 'The word "it" in the passage refers to', type: 'Reference', hl: 'it',
          opts: ['federal law', 'public acceptance', 'the idea that time should be coordinated', 'a large region'], a: 2 },
        { stem: 'What can be inferred about the residents who resisted standard zones?', type: 'Inference',
          opts: ['They lived far from railway lines.', 'They believed businesses should not decide how time is measured.', 'They preferred federal laws to company rules.', 'They wanted trains to run less often.'], a: 1 }
      ]
    }
  ]
};
