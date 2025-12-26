#!/bin/bash

# Setup CI Secrets for E2E Tests
# This script helps you safely add GitHub secrets needed for E2E testing

set -e

echo "════════════════════════════════════════════════════════════"
echo "  GitHub Secrets Setup for E2E Tests"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    echo "   Install it: brew install gh"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Error: Not authenticated with GitHub CLI"
    echo "   Run: gh auth login"
    exit 1
fi

echo "Current secrets in repository:"
gh secret list
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# Check what's missing
has_test_db=$(gh secret list | grep -c "TEST_DATABASE_URL" || true)
has_session=$(gh secret list | grep -c "SESSION_SECRET" || true)

if [ "$has_test_db" -eq 0 ]; then
    echo "❌ TEST_DATABASE_URL is missing"
else
    echo "✅ TEST_DATABASE_URL is set"
fi

if [ "$has_session" -eq 0 ]; then
    echo "❌ SESSION_SECRET is missing"
else
    echo "✅ SESSION_SECRET is set"
fi

echo ""

# If all secrets exist, we're done
if [ "$has_test_db" -gt 0 ] && [ "$has_session" -gt 0 ]; then
    echo "════════════════════════════════════════════════════════════"
    echo "✅ All required secrets are configured!"
    echo "════════════════════════════════════════════════════════════"
    exit 0
fi

echo "════════════════════════════════════════════════════════════"
echo ""
echo "⚠️  IMPORTANT: Keep production secrets separate!"
echo ""
echo "If you have production database secrets, make sure"
echo "TEST_DATABASE_URL points to a SEPARATE test database."
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

read -p "Do you want to add the missing secrets now? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping secret setup."
    echo ""
    echo "To add secrets manually:"
    echo "  gh secret set TEST_DATABASE_URL"
    echo "  gh secret set SESSION_SECRET"
    exit 0
fi

echo ""

# Add TEST_DATABASE_URL if missing
if [ "$has_test_db" -eq 0 ]; then
    echo "──────────────────────────────────────────────────────────"
    echo "Setting up TEST_DATABASE_URL"
    echo "──────────────────────────────────────────────────────────"
    echo ""
    echo "Options:"
    echo "  1. Use your dev database from .env.local (simpler)"
    echo "  2. Create a new test database on Neon (recommended)"
    echo ""

    if [ -f ".env.local" ] && grep -q "DATABASE_URL" .env.local; then
        echo "💡 Found DATABASE_URL in .env.local"
        echo ""
        read -p "Use the same database for tests? (y/n) " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Extract DATABASE_URL from .env.local
            db_url=$(grep "^DATABASE_URL=" .env.local | cut -d '=' -f 2- | tr -d '"' | tr -d "'")
            echo "$db_url" | gh secret set TEST_DATABASE_URL
            echo "✅ TEST_DATABASE_URL set from .env.local"
        else
            echo ""
            echo "Please paste your test database URL:"
            gh secret set TEST_DATABASE_URL
            echo "✅ TEST_DATABASE_URL set"
        fi
    else
        echo "Please paste your test database URL:"
        gh secret set TEST_DATABASE_URL
        echo "✅ TEST_DATABASE_URL set"
    fi
    echo ""
fi

# Add SESSION_SECRET if missing
if [ "$has_session" -eq 0 ]; then
    echo "──────────────────────────────────────────────────────────"
    echo "Setting up SESSION_SECRET"
    echo "──────────────────────────────────────────────────────────"
    echo ""

    if [ -f ".env.local" ] && grep -q "SESSION_SECRET" .env.local; then
        echo "💡 Found SESSION_SECRET in .env.local"
        echo ""
        read -p "Use the same session secret? (y/n) " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Extract SESSION_SECRET from .env.local
            session_secret=$(grep "^SESSION_SECRET=" .env.local | cut -d '=' -f 2- | tr -d '"' | tr -d "'")
            echo "$session_secret" | gh secret set SESSION_SECRET
            echo "✅ SESSION_SECRET set from .env.local"
        else
            echo ""
            echo "Generate new session secret? (y/n)"
            read -p "" -n 1 -r
            echo ""

            if [[ $REPLY =~ ^[Yy]$ ]]; then
                openssl rand -base64 32 | gh secret set SESSION_SECRET
                echo "✅ SESSION_SECRET generated and set"
            else
                echo "Please paste your session secret:"
                gh secret set SESSION_SECRET
                echo "✅ SESSION_SECRET set"
            fi
        fi
    else
        echo "Generate new session secret? (y/n)"
        read -p "" -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            openssl rand -base64 32 | gh secret set SESSION_SECRET
            echo "✅ SESSION_SECRET generated and set"
        else
            echo "Please paste your session secret:"
            gh secret set SESSION_SECRET
            echo "✅ SESSION_SECRET set"
        fi
    fi
    echo ""
fi

echo "════════════════════════════════════════════════════════════"
echo "✅ Secret setup complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Final secrets:"
gh secret list
echo ""
echo "Your E2E tests will now run on pull requests!"
