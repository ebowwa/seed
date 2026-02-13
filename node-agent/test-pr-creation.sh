#!/bin/bash
# Test script for GitHub PR creation to dev

set -e

echo "========================================"
echo "Testing GitHub PR Creation to Dev"
echo "========================================"
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found"
    echo "Install: https://cli.github.com/"
    exit 1
fi

echo "✓ GitHub CLI found: $(gh --version)"
echo ""

# Check if git repo is configured
cd /root/repos/main-repo
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository"
    exit 1
fi

echo "✓ Git repository: $(pwd)"
echo ""

# Check remote
REMOTE=$(git config --get remote.origin.url)
echo "✓ Remote: $REMOTE"
echo ""

# Check for GITHUB_TOKEN
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GITHUB_TOKEN not set in environment"
    echo ""
    echo "Set with:"
    echo "  export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx"
    echo ""
    echo "Or add to .env file."
    echo ""
fi

# Check if dev branch exists
echo "Checking for 'dev' branch..."
if git show-ref --verify --quiet refs/heads/dev; then
    echo "✓ Local 'dev' branch exists"
elif git show-ref --verify --quiet refs/remotes/origin/dev; then
    echo "✓ Remote 'dev' branch exists"
else
    echo "❌ 'dev' branch not found"
    echo ""
    echo "Create with:"
    echo "  git checkout -b dev main"
    echo "  git push -u origin dev"
    exit 1
fi
echo ""

# List current Ralph branches
echo "Current Ralph branches:"
git branch | grep -i ralph || echo "  (none)"
echo ""

# Test PR creation flow
echo "========================================"
echo "Testing PR Creation Flow"
echo "========================================"
echo ""

TEST_BRANCH="test/ralph-test-pr-$(date +%s)"
echo "1. Creating test branch: $TEST_BRANCH"
git checkout -b "$TEST_BRANCH" origin/dev 2>&1 | grep -v "^Switched\|^branch\|^Already on" || true

# Make a dummy change
echo "2. Making dummy change"
echo "test PR: $(date)" > /tmp/test-pr-$$.txt
cp /tmp/test-pr-$$.txt /root/repos/main-repo/test-pr.txt
git add test-pr.txt
git commit -m "test: PR creation test" 2>&1 | grep -v "^Author\|^Date\|^Committer\|^1 file\|^create mode" || true

# Push branch
echo "3. Pushing branch"
git push -u origin "$TEST_BRANCH" 2>&1 | grep -v "^Branch\|^remote:\|^To https" || true

# Create PR
echo "4. Creating PR to dev..."
if [ -n "$GITHUB_TOKEN" ]; then
    PR_URL=$(gh pr create \
        --base dev \
        --head "$TEST_BRANCH" \
        --title "Test PR: $TEST_BRANCH" \
        --body "Test PR created by test-pr-creation.sh" \
        2>&1 | grep -o "https://github.com/[^[:space:]]*")
    
    if [ -n "$PR_URL" ]; then
        echo "✓ PR created: $PR_URL"
        
        # Cleanup
        echo ""
        echo "Cleaning up..."
        gh pr close "$PR_URL" --delete-branch --comment "Test PR - closing" 2>&1 | grep -v "deleted" || true
        git checkout dev 2>&1 | grep -v "^Switched\|^branch" || true
        git branch -D "$TEST_BRANCH" 2>&1 | grep -v "^Deleted" || true
        rm -f /root/repos/main-repo/test-pr.txt /tmp/test-pr-$$.txt
        
        echo ""
        echo "========================================"
        echo "✓ PR creation test PASSED"
        echo "========================================"
    else
        echo "❌ Failed to create PR"
        exit 1
    fi
else
    echo "⚠️  Skipping PR creation (no GITHUB_TOKEN)"
    echo ""
    echo "To test PR creation:"
    echo "  export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx"
    echo "  ./test-pr-creation.sh"
fi
