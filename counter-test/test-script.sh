#!/bin/bash

# Tests both counter instances

echo "🚀 Starting Counter Thing Test"
echo "================================"

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Test Counter 1
echo ""
echo "🔢 Testing Counter 1 (http://localhost:3001)"
echo "----------------------------------------"

echo "📋 Getting Thing Description..."
curl -s http://localhost:3001/counter | jq '.title' 2>/dev/null || echo "Counter 1 Thing Description"

echo "📊 Reading initial count..."
COUNT1=$(curl -s http://localhost:3001/counter/properties/count)
echo "Initial count: $COUNT1"

echo "➕ Incrementing counter..."
curl -s -X POST http://localhost:3001/counter/actions/increment > /dev/null
sleep 1

echo "📊 Reading count after increment..."
COUNT1=$(curl -s http://localhost:3001/counter/properties/count)
echo "Count after increment: $COUNT1"

echo "➕ Incrementing by 5..."
curl -s -X POST "http://localhost:3001/counter/actions/increment?step=5" > /dev/null
sleep 1

echo "📊 Reading count after step increment..."
COUNT1=$(curl -s http://localhost:3001/counter/properties/count)
echo "Count after step increment: $COUNT1"

# Test Counter 2
echo ""
echo "🔢 Testing Counter 2 (http://localhost:3002)"
echo "----------------------------------------"

echo "📋 Getting Thing Description..."
curl -s http://localhost:3002/counter | jq '.title' 2>/dev/null || echo "Counter 2 Thing Description"

echo "📊 Reading initial count..."
COUNT2=$(curl -s http://localhost:3002/counter/properties/count)
echo "Initial count: $COUNT2"

echo "➖ Decrementing counter..."
curl -s -X POST http://localhost:3002/counter/actions/decrement > /dev/null
sleep 1

echo "📊 Reading count after decrement..."
COUNT2=$(curl -s http://localhost:3002/counter/properties/count)
echo "Count after decrement: $COUNT2"

echo "➖ Decrementing by 3..."
curl -s -X POST "http://localhost:3002/counter/actions/decrement?step=3" > /dev/null
sleep 1

echo "📊 Reading count after step decrement..."
COUNT2=$(curl -s http://localhost:3002/counter/properties/count)
echo "Count after step decrement: $COUNT2"

# Test image properties
echo ""
echo "🖼️  Testing Image Properties"
echo "---------------------------"

echo "📊 Getting count as SVG from Counter 1..."
curl -s http://localhost:3001/counter/properties/countAsImage | head -c 100
echo "..."

echo "📊 Getting count as red SVG from Counter 2..."
curl -s "http://localhost:3002/counter/properties/countAsImage?fill=red" | head -c 100
echo "..."

# Test reset functionality
echo ""
echo "🔄 Testing Reset Functionality"
echo "-----------------------------"

echo "🔄 Resetting Counter 1..."
curl -s -X POST http://localhost:3001/counter/actions/reset > /dev/null
sleep 1

echo "📊 Reading count after reset..."
COUNT1=$(curl -s http://localhost:3001/counter/properties/count)
echo "Counter 1 count after reset: $COUNT1"

echo "🔄 Resetting Counter 2..."
curl -s -X POST http://localhost:3002/counter/actions/reset > /dev/null
sleep 1

echo "📊 Reading count after reset..."
COUNT2=$(curl -s http://localhost:3002/counter/properties/count)
echo "Counter 2 count after reset: $COUNT2"

# Final status
echo ""
echo "✅ Test Summary"
echo "==============="
echo "Counter 1 final count: $COUNT1"
echo "Counter 2 final count: $COUNT2"
echo ""
echo "🎉 Counter Thing test completed!"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop services: docker-compose down"
