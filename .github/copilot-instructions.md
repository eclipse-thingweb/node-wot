## **AI Agent Instructions for eclipse-thingweb/node-wot**

### **Repository Context**

-   **Project**: Eclipse Thingweb Node-WoT
-   **Language**: TypeScript, JavaScript
-   **Purpose**: A fast and extensible framework to connect any device with your browser and backend applications
-   **Standards**: W3C Web of Things (WoT) specifications

---

## **WHEN PROVIDING CODE**

### **Pre-Development Requirements**

1. **Read the CONTRIBUTING.md file** at https://github.com/eclipse-thingweb/node-wot/blob/master/CONTRIBUTING.md
2. **Understand the W3C WoT standards** at https://www.w3.org/TR/2023/REC-wot-thing-description11-20231205/
3. **Verify Eclipse Foundation compliance**:
    - Contributor must have an Eclipse Foundation account with GitHub ID linked
    - Contributor must have signed the Eclipse Contributor Agreement (ECA)

### **Code Quality Standards**

1. **Linting & Formatting**:

    - Run `npm run lint` before committing
    - Run `npm run format` to automatically fix style issues
    - Ensure no ESLint warnings or errors remain
    - Follow the strict boolean expressions rule (use `==` or `!=` for null/undefined checks, not `if (var)`)

2. **Scope & Minimal Diffs**:

    - Keep changes limited to the specific feature/fix scope
    - Do not modify unrelated parts of files
    - Strive for the minimum git diff (fewest lines changed)
    - Avoid unnecessary refactoring outside the scope of work

3. **Testing**:

    - Run the full test suite before committing: `npm run test` or equivalent
    - Ensure all tests pass
    - Add tests for new features or fixes

4. **Special Attention for Core Changes**:

    - If modifying `packages/core`, understand that this impacts ALL other packages
    - Check if changes contradict the W3C WoT Scripting API specification: https://w3c.github.io/wot-scripting-api/
    - Verify all dependent packages are updated accordingly
    - Validate compatibility with existing protocol bindings

5. **Bypassing the Problem**:

    - If you do not find a solution to the problem, do not bypass it by typecasting, ignoring the tests etc.

6. **Commit Requirements**:

    - **All commits MUST be signed** using the contributor's Eclipse Foundation account email
    - Configure git: `git config user.email "<eclipse-account-email>"`
    - Commit with `-s` flag: `git commit -s -m "<message>"`
    - Follow Conventional Changelog format:

        ```
        <type>(<scope>): <subject>

        <body>

        <footer>
        ```

    - **Allowed types**: `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `chore`, `docs`
    - **Subject**: imperative mood, present tense, lowercase, no period
    - **Example**: `feat(binding-coap): add support for observe option`

### **Pull Request Requirements**

1. **PR Body MUST include**:

    - **Explanation of AI assistance used**: Describe how AI tools assisted in generating the code, specific aspects AI helped with, and what human review/validation was performed
    - **Concise change description**: Exactly what was changed, why, and technical details
    - **Do NOT discuss**: Benefits, impact on users, or general statements about the value of the change

2. **Example PR Body**:

    ```markdown
    ## AI Assistance Summary

    This PR was generated with AI assistance for boilerplate code generation and structural
    implementation. The AI helped with [specific aspect], while human verification confirmed
    [what was validated].

    ## Changes

    -   Modified `packages/binding-foo/src/foo-client.ts` to implement ProtocolClient interface
    -   Added error handling for connection timeouts
    -   Updated corresponding test file

    Fixes #123
    ```

3. **PR Process**:
    - Create feature branch from master
    - Do NOT merge with master while developing
    - If master updates are needed, rebase: `git checkout master && git pull && git checkout - && git rebase master`
    - Ensure CI/CD checks pass
    - Do NOT force push unless absolutely necessary

---

## **WHEN REVIEWING CODE**

### **Review Scope & Guidelines**

1. **Primary Focus Areas**:

    - Code correctness and adherence to W3C WoT standards
    - Compliance with repository coding standards (ESLint, Prettier, style guide)
    - Proper testing and test coverage
    - Commit message quality and signing
    - PR description completeness (especially AI assistance disclosure)

2. **Avoid Redundancy**:

    - Do NOT repeat observations already in the PR author's initial summary/first comment
    - Read the PR description first to understand context and intent

3. **W3C WoT Standards Validation**:

    - Verify implementation matches W3C WoT Thing Description specification
    - Check W3C WoT Scripting API compliance for any core changes
    - Validate protocol binding implementations against expected interfaces

4. **Ecosystem Impact Assessment**:
    - If reviewing core changes: verify impact across all dependent packages
    - Check if breaking changes are properly documented in PR body
    - Validate that bindings still function correctly

### **Comment Management**

1. **Consolidation Rule**:

    - If you find yourself writing more than 5 separate comments:
        - Consolidate into a single summarized comment
        - Organize by category (critical issues, style, suggestions)
        - Clearly mark blockers vs. optional improvements
        - Ask contributor to review and respond to the summary comment

2. **Comment Examples**:
    - ✅ **Good**: Points out specific issue with concrete fix suggestion
    - ❌ **Avoid**: Repeating the same point multiple times across different comments
    - ✅ **Good**: Consolidating multiple style issues into: "Code style issues found in 3 locations: [list]. Please run `npm run format`"

### **Approval Criteria**

-   [ ] All commits are signed with Eclipse account email
-   [ ] Code passes `npm run lint` and `npm run format`
-   [ ] All tests pass (`npm run test`)
-   [ ] PR body explains AI assistance and changes clearly
-   [ ] Conventional commit format followed
-   [ ] No unrelated changes to files
-   [ ] W3C WoT standards compliance verified
-   [ ] If core changes: dependent packages updated/validated
-   [ ] No merge conflicts with master

---

## **Key References for AI Agents**

| Resource                                                                                      | Purpose                       |
| --------------------------------------------------------------------------------------------- | ----------------------------- |
| [CONTRIBUTING.md](https://github.com/eclipse-thingweb/node-wot/blob/master/CONTRIBUTING.md)   | Full contribution guidelines  |
| [W3C WoT Thing Description](https://www.w3.org/TR/2023/REC-wot-thing-description11-20231205/) | Core specification            |
| [W3C WoT Scripting API](https://w3c.github.io/wot-scripting-api/)                             | Required for core/API changes |
| [Eclipse ECA](http://www.eclipse.org/legal/ECA.php)                                           | Legal requirements            |
| [Eclipse Committer Handbook](https://www.eclipse.org/projects/handbook/)                      | Best practices                |

---

## **Common Pitfalls to Avoid**

1. ❌ Unsigned commits → ✅ Always use `-s` flag with Eclipse account email
2. ❌ Linting warnings → ✅ Run `npm run lint && npm run format` before commit
3. ❌ Scope creep → ✅ Only modify files related to the specific change
4. ❌ Missing AI disclosure → ✅ Always explain AI assistance in PR body
5. ❌ Core changes without validation → ✅ Test impact on all dependent packages
6. ❌ Large diffs → ✅ Strive for minimal, focused changes
7. ❌ Verbose PR descriptions → ✅ Be concise and technical, not marketing-focused
8. ❌ Excessive review comments → ✅ Consolidate into organized summary at 5+ comments
